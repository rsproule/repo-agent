import { syncRepoPRs } from "@/ai/tools/sync-prs";
import { prisma } from "@/lib/db";
import { getInstallationTokenForUser } from "@/lib/github";
import { JobTracker } from "@/lib/job-tracker";
import { defaultLogger, type Logger } from "@/lib/logger";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { Octokit } from "octokit";
import { z } from "zod";

const openai = createOpenAI({
  apiKey: process.env.ECHO_API_KEY,
  baseURL: "https://echo.router.merit.systems",
});

export const BUCKET_CLASSIFIER_VERSION = "v0.0.1";
const NUM_PARALLEL_PR_PROCESSING = 10; // Process PRs in batches
const MAX_TOKENS_BEFORE_TRUNCATION = 100_000; // Max tokens per request

// System prompt for PR classification
export const PR_CLASSIFICATION_SYSTEM_PROMPT = `You are an expert software engineer analyzing GitHub pull requests to estimate their implementation complexity.

Your task: Classify this PR into one of 4 complexity buckets based on how long it would take an experienced engineer to implement from scratch.

## Evaluation Criteria

Consider these factors when estimating:
1. **Lines of code changed** - More changes typically mean more work, but context matters
2. **Number of files touched** - Cross-cutting changes increase complexity
3. **Type of changes**:
   - Simple refactors/renames are easier than new features
   - Config/dependency updates are usually quick
   - Bug fixes vary by root cause complexity
   - New features require design + implementation + testing
4. **Code complexity**:
   - Simple CRUD operations vs complex algorithms
   - UI changes vs backend logic vs infrastructure
   - Adding new code vs modifying existing systems
5. **Technical difficulty**:
   - Does it require deep domain knowledge?
   - Are there tricky edge cases or concurrency issues?
   - Does it involve multiple systems/services?

## Bucket Definitions

**Bucket 0 (≤1 hour)** - Trivial changes
- Examples: typo fixes, simple config updates, minor documentation changes
- Characteristics: <50 lines changed, 1-3 files, no logic changes
- Time: Can be done in a single focused session

**Bucket 1 (1-4 hours)** - Small features/fixes
- Examples: simple bug fixes, small UI tweaks, straightforward feature additions
- Characteristics: 50-200 lines, 3-10 files, isolated changes
- Time: Can be completed within a workday

**Bucket 2 (1 day - 1 week)** - Medium features/refactors
- Examples: multi-step features, significant refactors, cross-component changes
- Characteristics: 200-500 lines, 10-30 files, requires design decisions
- Time: Needs planning, implementation, and testing across multiple sessions

**Bucket 3 (>1 week)** - Major features/rewrites
- Examples: new subsystems, architectural changes, major feature launches
- Characteristics: >500 lines, >30 files, system-wide impact
- Time: Requires careful design, extensive testing, possibly breaking changes

## Edge Cases

- **Dependency updates**: Usually bucket 0-1 unless they require code changes
- **Generated code**: Discount heavily - focus on the hand-written changes
- **Test files**: Consider them but weight them less than production code
- **Documentation**: Usually adds minimal time unless it's comprehensive
- **Deletions**: Removing code is often harder than it looks - consider the context

## Your Response

Analyze the PR's diff and metadata, then classify it into the most appropriate bucket (0-3).`;

export interface BucketPRsConfig {
  owner: string;
  repo: string;
  echoUserId: string;
  fullResync?: boolean; // If true, re-classify all PRs even if already classified
}

export interface BucketPRsResult {
  totalProcessed: number;
  totalCost: number;
  runId: string;
}

interface FileEntry {
  filename: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
}

// Ignored file patterns (similar to Rust implementation)
class IgnoredPatterns {
  private static EXACT_MATCHES = [
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "Pipfile.lock",
    "poetry.lock",
    "Cargo.lock",
    "packages.lock.json",
    "Gemfile.lock",
    "go.sum",
    ".DS_Store",
    ".env",
  ];

  private static DIR_PREFIXES = [
    "node_modules/",
    "__pycache__/",
    ".pytest_cache/",
    ".venv/",
    "venv/",
    "target/",
    "dist/",
    "build/",
    ".next/",
    ".nuxt/",
    ".svelte-kit/",
    "bin/",
    "obj/",
    ".vs/",
    "vendor/",
    ".vscode/",
    ".idea/",
  ];

  private static EXTENSIONS = [".log", ".sqlite3", ".db"];

  static isIgnored(filePath: string): boolean {
    // Check exact matches
    if (
      this.EXACT_MATCHES.some(
        (m) => filePath === m || filePath.endsWith(`/${m}`),
      )
    ) {
      return true;
    }

    // Check directory prefixes
    if (this.DIR_PREFIXES.some((p) => filePath.includes(p))) {
      return true;
    }

    // Check extensions
    if (this.EXTENSIONS.some((e) => filePath.endsWith(e))) {
      return true;
    }

    return false;
  }
}

// Format files summary
function formatFilesSummary(files: FileEntry[]): string {
  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

  let summary = "<file_summary>\n";
  summary += `  <total_stats>\n    <files>${files.length}</files>\n    <additions>${totalAdditions}</additions>\n    <deletions>${totalDeletions}</deletions>\n  </total_stats>\n`;
  summary += "  <files>\n";

  for (const file of files) {
    summary += `    <file>\n      <path>${file.filename}</path>\n      <additions>${file.additions}</additions>\n      <deletions>${file.deletions}</deletions>\n    </file>\n`;
  }

  summary += "  </files>\n";
  summary += "</file_summary>\n";

  return summary;
}

// Format files to string with patch data
function formatFilesToString(files: FileEntry[]): string {
  return files
    .map(
      (file) =>
        `<File>\n    <Filename>\n        ${
          file.filename
        }\n    </Filename>\n    <Additions>\n        ${
          file.additions
        }\n    </Additions>\n    <Deletions>\n        ${
          file.deletions
        }\n    </Deletions>\n    <Patch>\n        ${
          file.patch || ""
        }\n    </Patch>\n</File>`,
    )
    .join("\n");
}

// Format PR user message
function formatPRUserMessage(
  title: string | null,
  body: string | null,
  prNumber: number,
  diffData: string,
  filesSummary: string,
): string {
  return `
<pr_metadata>
  <title>${title || ""}</title>
  <description>${body || ""}</description>
  <pr_number>${prNumber}</pr_number>
</pr_metadata>

${filesSummary}

<pr_diff>
${diffData}
</pr_diff>
`;
}

// Truncate string at UTF-8 boundary
function fastStringSlice(input: string, charLimit: number): string {
  if (charLimit >= input.length) {
    return input;
  }
  return input.slice(0, charLimit);
}

// Main bucket PRs function
export async function bucketPRs(
  config: BucketPRsConfig,
  logger: Logger = defaultLogger,
): Promise<BucketPRsResult> {
  const { owner, repo, echoUserId, fullResync = false } = config;

  logger.info("Starting PR bucketing", { owner, repo, fullResync });

  // Check for existing running job (idempotency)
  const jobTracker = new JobTracker(
    owner,
    repo,
    "bucket_prs",
    echoUserId,
    logger,
  );
  const { jobId, isNew } = await jobTracker.start({ fullResync });

  if (!isNew) {
    logger.info("Bucket job already running, returning existing job", {
      jobId,
    });
    // Return a placeholder result - the existing job will complete
    throw new Error(
      `Bucket job already running for ${owner}/${repo}. Please wait for it to complete.`,
    );
  }

  try {
    // Step 1: Sync PRs first
    logger.info("Syncing PRs from GitHub...");
    const syncResult = await syncRepoPRs(
      {
        owner,
        repo,
        echoUserId,
        pageSize: 100,
        requestDelayMs: 0,
      },
      logger,
    );

    if (syncResult.isErr()) {
      throw new Error(
        `Failed to sync PRs: ${syncResult.error.type} - ${syncResult.error.cause.message}`,
      );
    }

    logger.info("PR sync complete", {
      totalSynced: syncResult.value.totalSynced,
    });

    // Step 2: Get merged PR range
    const prRange = await prisma.$queryRaw<
      Array<{ min: number; max: number; count: bigint }>
    >`
    SELECT
      MIN(pr_number) as min,
      MAX(pr_number) as max,
      COUNT(*)::bigint as count
    FROM pull_requests
    WHERE owner = ${owner}
      AND repo = ${repo}
      AND state = 'closed'
      AND merged_at IS NOT NULL
  `;

    if (!prRange[0] || !prRange[0].min || !prRange[0].max) {
      throw new Error(`No merged PRs found for repository ${owner}/${repo}`);
    }

    const lowestPR = prRange[0].min;
    const highestPR = prRange[0].max;
    const prCount = Number(prRange[0].count);

    logger.info("PR range determined", { lowestPR, highestPR, prCount });

    // Step 3: Create classification run
    const classificationRun = await prisma.prBucketClassificationRun.create({
      data: {
        owner,
        repo,
        lowestPrNumber: lowestPR,
        highestPrNumber: highestPR,
        prCount,
        version: BUCKET_CLASSIFIER_VERSION,
        model: "gpt-4o-mini",
      },
    });

    logger.info("Created classification run", {
      runId: classificationRun.runId,
    });

    // Step 4: Get GitHub token and initialize Octokit
    const token = await getInstallationTokenForUser(echoUserId);
    const octokit = new Octokit({ auth: token });

    let totalCost = 0;
    let totalProcessed = 0;

    // Step 6: Process PRs in batches
    let skip = 0;
    const batchSize = NUM_PARALLEL_PR_PROCESSING;

    while (true) {
      // Get next batch of PRs
      const whereClause: {
        owner: string;
        repo: string;
        state: string;
        mergedAt: { not: null };
        prNumber?: { gt: number };
        buckets?: { none: {} };
      } = {
        owner,
        repo,
        state: "closed",
        mergedAt: { not: null },
      };

      // If not full resync, exclude already classified PRs
      if (!fullResync) {
        whereClause.buckets = { none: {} };
      }

      const prs = await prisma.pullRequestRecord.findMany({
        where: whereClause,
        take: batchSize,
        skip,
        orderBy: { prNumber: "asc" },
      });

      if (prs.length === 0) {
        break;
      }

      logger.info(`Processing batch of ${prs.length} PRs`, {
        skip,
        total: totalProcessed,
      });

      // Process PRs in parallel
      const results = await Promise.allSettled(
        prs.map((pr) => processSinglePR(pr, owner, repo, octokit, logger)),
      );

      // Collect successful results
      const bucketEntries = [];
      let batchCost = 0;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const pr = prs[i];

        if (result.status === "fulfilled") {
          const { bucket, usage } = result.value;
          batchCost += usage.cost;

          bucketEntries.push({
            runId: classificationRun.runId,
            owner,
            repo,
            prNumber: pr.prNumber,
            prId: pr.prId,
            bucket,
            additions: null, // Will be updated from file data if available
            deletions: null,
            changedFiles: null,
          });
        } else {
          logger.error(`Failed to process PR #${pr.prNumber}`, {
            error: result.reason,
          });
        }
      }

      // Batch insert classifications
      if (bucketEntries.length > 0) {
        // Get author info for the PRs FIRST
        const prNumbers = bucketEntries.map((e) => e.prNumber);
        const prAuthors = await prisma.pullRequestRecord.findMany({
          where: {
            owner,
            repo,
            prNumber: { in: prNumbers },
          },
          select: {
            prNumber: true,
            author: true,
          },
        });

        const authorMap = new Map(
          prAuthors.map((pr) => [pr.prNumber, pr.author]),
        );

        // Create scores from buckets
        // Bucket → Score mapping: 0→-2.0, 1→-1.0, 2→1.0, 3→2.0
        const scoreEntries = bucketEntries.map((entry) => {
          const score =
            entry.bucket === 0
              ? -2.0
              : entry.bucket === 1
              ? -1.0
              : entry.bucket === 2
              ? 1.0
              : 2.0;

          return {
            prId: entry.prId,
            owner: entry.owner,
            repo: entry.repo,
            prNumber: entry.prNumber,
            author: authorMap.get(entry.prNumber) || "unknown",
            authorGithubId: null,
            bucket: entry.bucket,
            score,
            initRunId: classificationRun.runId,
            initVersion: "bts1.0",
            updaterVersion: null,
          };
        });

        // Insert both buckets AND scores in single transaction to ensure atomicity
        await prisma.$transaction([
          prisma.prBucket.createMany({
            data: bucketEntries,
            skipDuplicates: true,
          }),
          prisma.prScore.createMany({
            data: scoreEntries,
            skipDuplicates: true,
          }),
        ]);

        totalCost += batchCost;
        totalProcessed += bucketEntries.length;

        logger.info("Batch complete", {
          processed: bucketEntries.length,
          scores: scoreEntries.length,
          batchCost: batchCost.toFixed(4),
          totalCost: totalCost.toFixed(4),
        });
      }

      skip += batchSize;
    }

    // Step 7: Mark run as completed
    await prisma.prBucketClassificationRun.update({
      where: { runId: classificationRun.runId },
      data: {
        completedAt: new Date(),
        totalCost,
      },
    });

    logger.info("PR bucketing complete", {
      totalProcessed,
      totalCost: totalCost.toFixed(4),
      runId: classificationRun.runId,
    });

    // Mark job as complete
    await jobTracker.complete(jobId, {
      totalProcessed,
      totalCost,
      runId: classificationRun.runId,
    });

    return {
      totalProcessed,
      totalCost,
      runId: classificationRun.runId,
    };
  } catch (error) {
    // Mark job as failed
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await jobTracker.fail(jobId, errorMessage);
    throw error;
  }
}

// Define the schema for PR classification
const PRClassificationSchema = z.object({
  bucket: z
    .number()
    .int()
    .min(0)
    .max(3)
    .describe("Classification bucket (0-3) based on complexity and impact"),
});

// Process a single PR
async function processSinglePR(
  pr: { prNumber: number; prId: bigint; title?: string; body?: string | null },
  owner: string,
  repo: string,
  octokit: Octokit,
  _logger: Logger,
): Promise<{ bucket: number; usage: UsageInfo }> {
  // Fetch PR files
  const { data: files } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: pr.prNumber,
    per_page: 100,
  });

  // Filter ignored files
  const filteredFiles: FileEntry[] = files
    .filter((f) => !IgnoredPatterns.isIgnored(f.filename))
    .map((f) => ({
      filename: f.filename,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
      patch: f.patch,
    }));

  // Generate files summary and diff
  const filesSummary = formatFilesSummary(filteredFiles);
  const diffData = formatFilesToString(filteredFiles);

  // Create user message
  let userMessage = formatPRUserMessage(
    pr.title ?? null,
    pr.body === undefined ? null : pr.body,
    pr.prNumber,
    diffData,
    filesSummary,
  );

  // Truncate if needed (conservative estimate: 4 chars per token)
  if (userMessage.length > MAX_TOKENS_BEFORE_TRUNCATION * 4) {
    userMessage = fastStringSlice(
      userMessage,
      MAX_TOKENS_BEFORE_TRUNCATION * 4,
    );
    userMessage += "\n\n[Note: Content was truncated due to token limit]";
  }

  // Call OpenAI through Echo SDK
  const result = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: PRClassificationSchema,
    system: PR_CLASSIFICATION_SYSTEM_PROMPT,
    prompt: userMessage,
    temperature: 0.3,
  });

  const usage = result.usage;

  // Calculate cost (GPT-4o pricing: $2.50 per 1M input tokens, $10.00 per 1M output tokens)
  const inputCost = ((usage?.inputTokens ?? 0) / 1_000_000) * 2.5;
  const outputCost = ((usage?.outputTokens ?? 0) / 1_000_000) * 10.0;
  const totalCost = inputCost + outputCost;

  return {
    bucket: result.object.bucket,
    usage: {
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      totalTokens: usage?.totalTokens ?? 0,
      cost: totalCost,
    },
  };
}
