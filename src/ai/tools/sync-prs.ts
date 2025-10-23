import { prisma } from "@/lib/db";
import { getInstallationTokenForUser } from "@/lib/github";
import { defaultLogger, type Logger } from "@/lib/logger";
import { err, ok, Result, ResultAsync } from "neverthrow";
import { Octokit } from "octokit";

// Use Octokit's typed response
type PullRequest = Awaited<
  ReturnType<Octokit["rest"]["pulls"]["list"]>
>["data"][number];

export interface SyncRepoPRsConfig {
  owner: string;
  repo: string;
  pageSize?: number;
  requestDelayMs?: number;
  echoUserId: string;
  token?: string;
}

export interface SyncResult {
  totalSynced: number;
  latestPR?: PullRequest;
}

export type SyncError =
  | { type: "Auth"; cause: Error }
  | { type: "GitHub"; cause: Error }
  | { type: "Database"; cause: Error }
  | { type: "Validation"; cause: Error };

/**
 * Main entry point for syncing PRs for a repository
 */
export async function syncRepoPRs(
  config: SyncRepoPRsConfig,
  logger: Logger = defaultLogger,
): Promise<Result<SyncResult, SyncError>> {
  const { owner, repo } = config;
  logger.info("Starting PR sync", { owner, repo });

  const isStaleResult = await checkIfStale(config, logger);
  if (isStaleResult.isErr()) {
    return err(isStaleResult.error);
  }

  if (!isStaleResult.value) {
    logger.info("No sync needed - already up to date", { owner, repo });
    return ok({ totalSynced: 0 });
  }

  // Phase 1: Initial sync
  const phaseOneResult = await phaseOnePRInitialSync(config, logger);
  if (phaseOneResult.isErr()) {
    return err(phaseOneResult.error);
  }

  logger.info("Phase 1 complete", {
    synced: phaseOneResult.value.totalSynced,
    owner,
    repo,
  });

  // Phase 2: Update sync
  const phaseTwoResult = await phaseTwoPRUpdateSync(config, logger);
  if (phaseTwoResult.isErr()) {
    return err(phaseTwoResult.error);
  }

  logger.info("Phase 2 complete", {
    synced: phaseTwoResult.value.totalSynced,
    owner,
    repo,
  });

  const totalSynced =
    phaseOneResult.value.totalSynced + phaseTwoResult.value.totalSynced;
  logger.info("PR sync complete", { totalSynced, owner, repo });

  return ok({
    totalSynced,
    latestPR: phaseOneResult.value.latestPR || phaseTwoResult.value.latestPR,
  });
}

/**
 * Check if the local database is stale compared to GitHub
 */
async function checkIfStale(
  config: SyncRepoPRsConfig,
  logger: Logger,
): Promise<Result<boolean, SyncError>> {
  const { owner, repo } = config;

  const octokitResult = await getOctokitResult(config);
  if (octokitResult.isErr()) {
    return err(octokitResult.error);
  }
  const octokit = octokitResult.value;

  // Get the repository
  const repoResult = await ResultAsync.fromPromise(
    octokit.rest.repos.get({ owner, repo }),
    (e) => ({
      type: "GitHub" as const,
      cause: e instanceof Error ? e : new Error(String(e)),
    }),
  );

  if (repoResult.isErr()) {
    logger.error("Error checking staleness, assuming stale", {
      error: repoResult.error,
    });
    return ok(true);
  }

  // Get latest local PR
  const latestLocalResult = await ResultAsync.fromPromise(
    prisma.pullRequestRecord.findFirst({
      where: { owner, repo },
      orderBy: { prNumber: "desc" },
    }),
    (e) => ({
      type: "Database" as const,
      cause: e instanceof Error ? e : new Error(String(e)),
    }),
  );

  if (latestLocalResult.isErr()) {
    return err(latestLocalResult.error);
  }

  // Get latest GitHub PR
  const latestGithubResult = await getLatestPR(octokit, owner, repo);
  if (latestGithubResult.isErr()) {
    logger.error("Error fetching latest PR, assuming stale", {
      error: latestGithubResult.error,
    });
    return ok(true);
  }

  // Get most recently updated local PR
  const mostRecentlyUpdatedLocalResult = await ResultAsync.fromPromise(
    prisma.pullRequestRecord.findFirst({
      where: { owner, repo },
      orderBy: { prUpdatedAt: "desc" },
    }),
    (e) => ({
      type: "Database" as const,
      cause: e instanceof Error ? e : new Error(String(e)),
    }),
  );

  if (mostRecentlyUpdatedLocalResult.isErr()) {
    return err(mostRecentlyUpdatedLocalResult.error);
  }

  // Get most recently updated GitHub PR
  const mostRecentlyUpdatedGithubResult = await getLatestPRRecentlyUpdated(
    octokit,
    owner,
    repo,
  );
  if (mostRecentlyUpdatedGithubResult.isErr()) {
    logger.error("Error fetching recently updated PR, assuming stale", {
      error: mostRecentlyUpdatedGithubResult.error,
    });
    return ok(true);
  }

  const latestLocal = latestLocalResult.value;
  const latestGithub = latestGithubResult.value;
  const mostRecentlyUpdatedLocal = mostRecentlyUpdatedLocalResult.value;
  const mostRecentlyUpdatedGithub = mostRecentlyUpdatedGithubResult.value;

  // Check Phase 1 staleness (new PRs)
  const phaseOneStale =
    latestLocal?.prNumber !== latestGithub?.number &&
    latestGithub?.number !== undefined;

  // Check Phase 2 staleness (updated PRs)
  let phaseTwoStale = false;
  if (mostRecentlyUpdatedLocal && mostRecentlyUpdatedGithub?.updated_at) {
    const localUpdated = new Date(mostRecentlyUpdatedLocal.prUpdatedAt);
    const githubUpdated = new Date(mostRecentlyUpdatedGithub.updated_at);
    phaseTwoStale = localUpdated < githubUpdated;
  } else if (!mostRecentlyUpdatedLocal && mostRecentlyUpdatedGithub) {
    phaseTwoStale = true;
  }

  logger.info("Staleness check complete", {
    phaseOneStale,
    phaseTwoStale,
    latestLocalPR: latestLocal?.prNumber,
    latestGithubPR: latestGithub?.number,
  });

  return ok(phaseOneStale || phaseTwoStale);
}

/**
 * Phase 1: Initial sync to catch up on new PRs (sorted by PR number)
 */
async function phaseOnePRInitialSync(
  config: SyncRepoPRsConfig,
  logger: Logger,
): Promise<Result<SyncResult, SyncError>> {
  const { owner, repo, echoUserId } = config;

  const octokitResult = await getOctokitResult(config);
  if (octokitResult.isErr()) {
    return err(octokitResult.error);
  }
  const octokit = octokitResult.value;

  // Get the repository
  const repoResult = await ResultAsync.fromPromise(
    octokit.rest.repos.get({ owner, repo }),
    (e) => ({
      type: "GitHub" as const,
      cause: e instanceof Error ? e : new Error(String(e)),
    }),
  );

  if (repoResult.isErr()) {
    return err(repoResult.error);
  }

  // Find the latest remote PR
  const latestRemoteResult = await getLatestPR(octokit, owner, repo);
  if (latestRemoteResult.isErr()) {
    return err(latestRemoteResult.error);
  }

  const latestRemote = latestRemoteResult.value;
  if (!latestRemote) {
    logger.info("No PRs found on GitHub", { owner, repo });
    return ok({ totalSynced: 0 });
  }

  // Get last synced PR marker
  const lastSyncedPRResult = await ResultAsync.fromPromise(
    prisma.pullRequestRecord.findFirst({
      where: { owner, repo },
      orderBy: { prNumber: "desc" },
    }),
    (e) => ({
      type: "Database" as const,
      cause: e instanceof Error ? e : new Error(String(e)),
    }),
  );

  if (lastSyncedPRResult.isErr()) {
    return err(lastSyncedPRResult.error);
  }

  const lastSyncedPR = lastSyncedPRResult.value;

  // Count PRs before the last synced PR
  let localCount = 0;
  if (lastSyncedPR) {
    const countResult = await ResultAsync.fromPromise(
      prisma.pullRequestRecord.count({
        where: {
          owner,
          repo,
          prNumber: { lte: lastSyncedPR.prNumber },
        },
      }),
      (e) => ({
        type: "Database" as const,
        cause: e instanceof Error ? e : new Error(String(e)),
      }),
    );

    if (countResult.isErr()) {
      return err(countResult.error);
    }

    localCount = countResult.value;
  }

  // Calculate page range
  const firstPage = Math.floor(localCount / 100) + 1;
  const lastPage = Math.floor(latestRemote.number / 100) + 1;

  logger.info("Phase 1 sync range calculated", {
    firstPage,
    lastPage,
    localCount,
    latestRemotePR: latestRemote.number,
  });

  // Process pages in batches
  const result = await syncPagesBatched(
    octokit,
    owner,
    repo,
    firstPage,
    lastPage,
    echoUserId,
    logger,
  );

  if (result.isErr()) {
    return err(result.error);
  }

  logger.info("Phase 1 sync complete", {
    totalSynced: result.value.totalSynced,
    owner,
    repo,
  });

  return ok(result.value);
}

/**
 * Sync pages in batches
 */
async function syncPagesBatched(
  octokit: Octokit,
  owner: string,
  repo: string,
  startPage: number,
  endPage: number,
  echoUserId: string,
  logger: Logger,
): Promise<Result<SyncResult, SyncError>> {
  const batchSize = 10;
  let currentPage = startPage;
  let totalSynced = 0;
  let latestPR: PullRequest | undefined;

  while (currentPage <= endPage) {
    const pageRange: [number, number] = [
      currentPage,
      Math.min(currentPage + batchSize - 1, endPage),
    ];

    const result = await syncPages(
      octokit,
      owner,
      repo,
      pageRange,
      echoUserId,
      logger,
    );

    if (result.isErr()) {
      return err(result.error);
    }

    totalSynced += result.value.totalSynced;
    if (result.value.latestPR) {
      latestPR = result.value.latestPR;
    }

    // If we got less than a full batch, we're done
    if (result.value.totalSynced < batchSize * 100) {
      break;
    }

    currentPage += batchSize;
  }

  return ok({ totalSynced, latestPR });
}

/**
 * Phase 2: Update sync for recently modified PRs (sorted by updated_at)
 */
async function phaseTwoPRUpdateSync(
  config: SyncRepoPRsConfig,
  logger: Logger,
): Promise<Result<SyncResult, SyncError>> {
  const { owner, repo, echoUserId } = config;

  const octokitResult = await getOctokitResult(config);
  if (octokitResult.isErr()) {
    return err(octokitResult.error);
  }
  const octokit = octokitResult.value;

  // Get most recently updated local PR
  const mostRecentlyUpdatedLocalResult = await ResultAsync.fromPromise(
    prisma.pullRequestRecord.findFirst({
      where: { owner, repo },
      orderBy: { prUpdatedAt: "desc" },
    }),
    (e) => ({
      type: "Database" as const,
      cause: e instanceof Error ? e : new Error(String(e)),
    }),
  );

  if (mostRecentlyUpdatedLocalResult.isErr()) {
    return err(mostRecentlyUpdatedLocalResult.error);
  }

  const mostRecentlyUpdatedLocal = mostRecentlyUpdatedLocalResult.value;
  if (!mostRecentlyUpdatedLocal) {
    logger.info("No local PRs found, skipping Phase 2", { owner, repo });
    return ok({ totalSynced: 0 });
  }

  const lastProcessedUpdatedAt = mostRecentlyUpdatedLocal.prUpdatedAt;
  logger.info("Starting Phase 2 sync", {
    since: lastProcessedUpdatedAt,
    owner,
    repo,
  });

  const result = await syncRecentlyUpdatedPRs(
    octokit,
    owner,
    repo,
    lastProcessedUpdatedAt,
    echoUserId,
    logger,
  );

  if (result.isErr()) {
    return err(result.error);
  }

  logger.info("Phase 2 sync complete", {
    totalSynced: result.value.totalSynced,
    owner,
    repo,
  });

  return ok(result.value);
}

/**
 * Sync recently updated PRs recursively
 */
async function syncRecentlyUpdatedPRs(
  octokit: Octokit,
  owner: string,
  repo: string,
  lastProcessedUpdatedAt: Date,
  echoUserId: string,
  logger: Logger,
  page: number = 1,
  totalSynced: number = 0,
  latestPR?: PullRequest,
): Promise<Result<SyncResult, SyncError>> {
  const prsResult = await ResultAsync.fromPromise(
    octokit.rest.pulls.list({
      owner,
      repo,
      state: "all",
      sort: "updated",
      direction: "desc",
      per_page: 100,
      page,
    }),
    (e) => ({
      type: "GitHub" as const,
      cause: e instanceof Error ? e : new Error(String(e)),
    }),
  );

  if (prsResult.isErr()) {
    return err(prsResult.error);
  }

  const prs = prsResult.value.data;

  if (prs.length === 0) {
    return ok({ totalSynced, latestPR });
  }

  let newTotalSynced = totalSynced;
  let newLatestPR = latestPR;
  let reachedProcessedPRs = false;

  // Process PRs sequentially
  for (const pr of prs) {
    // Check if this PR's updated_at is older than our last processed PR
    if (pr.updated_at) {
      const prUpdatedAt = new Date(pr.updated_at);
      if (prUpdatedAt <= lastProcessedUpdatedAt) {
        reachedProcessedPRs = true;
        break;
      }
    }

    // Upsert the PR
    const upsertResult = await upsertPR(pr, owner, repo, echoUserId, logger);
    if (upsertResult.isErr()) {
      return err(upsertResult.error);
    }

    newTotalSynced++;
    newLatestPR = pr;

    logger.debug("Updated PR in Phase 2", {
      prNumber: pr.number,
      updatedAt: pr.updated_at,
    });
  }

  if (reachedProcessedPRs) {
    return ok({ totalSynced: newTotalSynced, latestPR: newLatestPR });
  }

  // Continue to next page
  return syncRecentlyUpdatedPRs(
    octokit,
    owner,
    repo,
    lastProcessedUpdatedAt,
    echoUserId,
    logger,
    page + 1,
    newTotalSynced,
    newLatestPR,
  );
}

/**
 * Sync a range of pages in parallel
 */
async function syncPages(
  octokit: Octokit,
  owner: string,
  repo: string,
  pageRange: [number, number],
  echoUserId: string,
  logger: Logger,
): Promise<Result<SyncResult, SyncError>> {
  const [startPage, endPage] = pageRange;

  // Create parallel requests for each page
  const pagePromises: Promise<Result<SyncResult, SyncError>>[] = [];
  for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
    pagePromises.push(
      syncSinglePage(octokit, owner, repo, pageNum, echoUserId, logger),
    );
  }

  const results = await Promise.all(pagePromises);

  // Check if any failed
  for (const result of results) {
    if (result.isErr()) {
      return err(result.error);
    }
  }

  let totalSynced = 0;
  let latestPR: PullRequest | undefined;

  for (const result of results) {
    if (result.isOk()) {
      totalSynced += result.value.totalSynced;
      if (
        result.value.latestPR &&
        (!latestPR || result.value.latestPR.number > latestPR.number)
      ) {
        latestPR = result.value.latestPR;
      }
    }
  }

  return ok({ totalSynced, latestPR });
}

/**
 * Sync a single page of PRs with retry logic
 */
async function syncSinglePage(
  octokit: Octokit,
  owner: string,
  repo: string,
  pageNum: number,
  echoUserId: string,
  logger: Logger,
  attempt: number = 0,
): Promise<Result<SyncResult, SyncError>> {
  const maxRetries = 3;

  const prsResult = await ResultAsync.fromPromise(
    octokit.rest.pulls.list({
      owner,
      repo,
      state: "all",
      per_page: 100,
      page: pageNum,
    }),
    (e) => ({
      type: "GitHub" as const,
      cause: e instanceof Error ? e : new Error(String(e)),
    }),
  );

  if (prsResult.isErr()) {
    const error = prsResult.error;
    const errorStatus = (error.cause as { status?: number })?.status;

    // Handle specific errors
    if (errorStatus === 401 || errorStatus === 403) {
      logger.error("Authentication error, not retrying", {
        status: errorStatus,
        pageNum,
      });
      return err(error);
    }

    if (attempt >= maxRetries) {
      logger.error("Max retries exceeded", { pageNum, error });
      return err(error);
    }

    logger.warn("Retrying page sync", {
      pageNum,
      attempt: attempt + 1,
      error,
    });

    // Exponential backoff
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));

    return syncSinglePage(
      octokit,
      owner,
      repo,
      pageNum,
      echoUserId,
      logger,
      attempt + 1,
    );
  }

  const prs = prsResult.value.data;

  if (prs.length === 0) {
    return ok({ totalSynced: 0 });
  }

  // Upsert all PRs
  for (const pr of prs) {
    const upsertResult = await upsertPR(pr, owner, repo, echoUserId, logger);
    if (upsertResult.isErr()) {
      return err(upsertResult.error);
    }
  }

  const latestPR = prs.reduce((latest, pr) =>
    !latest || pr.number > latest.number ? pr : latest,
  );

  return ok({ totalSynced: prs.length, latestPR });
}

/**
 * Upsert a PR to the database
 */
async function upsertPR(
  pr: PullRequest,
  owner: string,
  repo: string,
  echoUserId: string,
  logger: Logger,
): Promise<Result<void, SyncError>> {
  const result = await ResultAsync.fromPromise(
    prisma.pullRequestRecord.upsert({
      where: {
        owner_repo_prNumber: {
          owner,
          repo,
          prNumber: pr.number,
        },
      },
      create: {
        owner,
        repo,
        prNumber: pr.number,
        prId: BigInt(pr.id),
        title: pr.title,
        author: pr.user?.login || "unknown",
        state: pr.state,
        htmlUrl: pr.html_url,
        body: pr.body,
        prCreatedAt: new Date(pr.created_at),
        prUpdatedAt: pr.updated_at ? new Date(pr.updated_at) : new Date(),
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
        echoUserId,
      },
      update: {
        title: pr.title,
        state: pr.state,
        body: pr.body,
        prUpdatedAt: pr.updated_at ? new Date(pr.updated_at) : new Date(),
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
      },
    }),
    (e) => {
      logger.error("Failed to upsert PR", { prNumber: pr.number, error: e });
      return {
        type: "Database" as const,
        cause: e instanceof Error ? e : new Error(String(e)),
      };
    },
  );

  if (result.isErr()) {
    return err(result.error);
  }

  return ok(undefined);
}

/**
 * Get the latest PR by number (highest PR number)
 */
async function getLatestPR(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<Result<PullRequest | null, SyncError>> {
  const result = await ResultAsync.fromPromise(
    octokit.rest.pulls.list({
      owner,
      repo,
      state: "all",
      per_page: 1,
      page: 1,
    }),
    (e) => ({
      type: "GitHub" as const,
      cause: e instanceof Error ? e : new Error(String(e)),
    }),
  );

  if (result.isErr()) {
    return err(result.error);
  }

  return ok(result.value.data[0] || null);
}

/**
 * Get the most recently updated PR
 */
async function getLatestPRRecentlyUpdated(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<Result<PullRequest | null, SyncError>> {
  const result = await ResultAsync.fromPromise(
    octokit.rest.pulls.list({
      owner,
      repo,
      state: "all",
      sort: "updated",
      direction: "desc",
      per_page: 1,
      page: 1,
    }),
    (e) => ({
      type: "GitHub" as const,
      cause: e instanceof Error ? e : new Error(String(e)),
    }),
  );

  if (result.isErr()) {
    return err(result.error);
  }

  return ok(result.value.data[0] || null);
}

/**
 * Get or create Octokit instance with authentication
 */
async function getOctokitResult(
  config: SyncRepoPRsConfig,
): Promise<Result<Octokit, SyncError>> {
  if (config.token) {
    return ok(new Octokit({ auth: config.token }));
  }

  const tokenResult = await ResultAsync.fromPromise(
    getInstallationTokenForUser(config.echoUserId),
    (e) => ({
      type: "Auth" as const,
      cause: e instanceof Error ? e : new Error(String(e)),
    }),
  );

  if (tokenResult.isErr()) {
    return err(tokenResult.error);
  }

  return ok(new Octokit({ auth: tokenResult.value }));
}
