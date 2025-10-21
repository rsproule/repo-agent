import {
  getPullRequestFiles,
  getRepositoryPullRequests,
} from "@/github/queries";
import { prisma } from "@/lib/db";
import { getGitHubInstallationToken } from "@/lib/github-token-provider";
import { defaultLogger, type Logger } from "@/lib/logger";
import type { PRAnalysis, PullRequest } from "@/types/github";
import { Octokit } from "@octokit/core";
import { err, ok, Result, ResultAsync } from "neverthrow";
import { analyzePullRequest } from "./pr-analyzer";

export type PipelineError =
  | { type: "Auth"; cause: Error }
  | { type: "GitHub"; cause: Error }
  | { type: "Analysis"; cause: Error }
  | { type: "Database"; cause: Error };

export interface PRWithAnalysis extends PullRequest {
  analysis?: PRAnalysis;
  filesChangedCount?: number;
}

export interface PRTriageResult {
  totalPRs: number;
  prs: PRWithAnalysis[];
  stats: {
    analyzed: number;
    skipped: number;
    failed: number;
  };
}

/**
 * Wrapper for getGitHubInstallationToken that returns a Result
 */
async function getInstallationTokenResult(
  echoUserId: string,
  logger: Logger,
): Promise<Result<string, PipelineError>> {
  logger.info("Fetching GitHub installation token", { echoUserId });
  return await ResultAsync.fromPromise(
    getGitHubInstallationToken(echoUserId),
    (e) => ({
      type: "Auth" as const,
      cause: e instanceof Error ? e : new Error(String(e)),
    }),
  );
}

/**
 * Execute PR triage pipeline for a specific repository
 */
export async function executePRTriagePipeline(
  owner: string,
  repo: string,
  echoUserId: string,
  logger: Logger = defaultLogger,
): Promise<Result<PRTriageResult, PipelineError>> {
  logger.info("Starting PR triage pipeline", { owner, repo, echoUserId });

  const stats = { analyzed: 0, skipped: 0, failed: 0 };

  try {
    // 1) Get installation token
    const tokenRes = await getInstallationTokenResult(echoUserId, logger);
    if (tokenRes.isErr()) {
      logger.error("Failed to get installation token", {
        error: tokenRes.error,
      });
      return err(tokenRes.error);
    }
    logger.info("Successfully obtained GitHub installation token");

    // 2) Create Octokit client with token
    const octokit = new Octokit({ auth: tokenRes.value });
    logger.info("Created Octokit client");

    // 3) Fetch all open PRs for the repository
    logger.info("Fetching open PRs", { owner, repo });
    const prsRes = await getRepositoryPullRequests(
      octokit,
      owner,
      repo,
      "open",
    );
    if (prsRes.isErr()) {
      logger.error("Failed to fetch PRs", { error: prsRes.error.message });
      return err({ type: "GitHub", cause: prsRes.error });
    }

    const prs = prsRes.value;
    logger.info(`Found ${prs.length} open PRs in ${owner}/${repo}`, {
      totalPRs: prs.length,
      prNumbers: prs.map((pr) => pr.number),
    });

    // 4) Upsert PRs to database
    logger.info("Upserting PRs to database");
    for (const pr of prs) {
      await prisma.pullRequestRecord.upsert({
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
          author: pr.user.login,
          state: pr.state,
          htmlUrl: pr.html_url,
          body: pr.body,
          prCreatedAt: new Date(pr.created_at),
          prUpdatedAt: new Date(pr.created_at),
          mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
          echoUserId,
        },
        update: {
          title: pr.title,
          state: pr.state,
          prUpdatedAt: new Date(pr.created_at),
          mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
          body: pr.body,
        },
      });
    }
    logger.info("PRs upserted to database");

    // 5) Analyze each PR with memoization
    logger.info("Starting AI analysis of PRs");

    for (const pr of prs) {
      logger.info(`Processing PR #${pr.number}`, {
        title: pr.title,
        author: pr.user.login,
      });

      try {
        // Check if we need to analyze this PR
        const existingPR = await prisma.pullRequestRecord.findUnique({
          where: {
            owner_repo_prNumber: {
              owner,
              repo,
              prNumber: pr.number,
            },
          },
          include: {
            analysis: true,
          },
        });

        // Memoization: skip if PR hasn't been updated since last analysis
        // AND the analysis has all required fields (like aiGenerated)
        const hasCompleteAnalysis = existingPR?.analysis?.aiGenerated != null;

        logger.info(`Checking PR #${pr.number} for analysis`, {
          hasExistingAnalysis: !!existingPR?.analysis,
          hasLastAnalyzedAt: !!existingPR?.lastAnalyzedAt,
          hasAiGenerated: existingPR?.analysis?.aiGenerated != null,
          hasCompleteAnalysis,
          willSkip: !!(
            existingPR?.lastAnalyzedAt &&
            new Date(pr.created_at) <= existingPR.lastAnalyzedAt &&
            hasCompleteAnalysis
          ),
        });

        if (
          existingPR?.lastAnalyzedAt &&
          new Date(pr.created_at) <= existingPR.lastAnalyzedAt &&
          hasCompleteAnalysis
        ) {
          logger.info(
            `✅ Skipping PR #${pr.number} - already has complete analysis`,
            {
              lastAnalyzedAt: existingPR.lastAnalyzedAt,
            },
          );
          stats.skipped++;
          continue;
        }

        if (existingPR?.lastAnalyzedAt && !hasCompleteAnalysis) {
          logger.info(
            `🔄 Re-analyzing PR #${pr.number} - missing AI generation data`,
            {
              lastAnalyzedAt: existingPR.lastAnalyzedAt,
            },
          );
        } else if (!existingPR?.lastAnalyzedAt) {
          logger.info(`🆕 First-time analysis for PR #${pr.number}`);
        }

        // Fetch files for this PR
        const filesRes = await getPullRequestFiles(
          octokit,
          owner,
          repo,
          pr.number,
        );

        if (filesRes.isErr()) {
          logger.warn(`Could not fetch files for PR #${pr.number}`, {
            error: filesRes.error.message,
          });
          stats.failed++;
          continue;
        }

        const files = filesRes.value;
        logger.info(`PR #${pr.number} has ${files.length} files changed`);

        // Analyze the PR with AI
        const analysis = await analyzePullRequest(pr, files, { owner, repo });

        // Debug: Log if aiGenerated is missing
        if (!analysis.aiGenerated) {
          logger.warn(`PR #${pr.number} analysis missing aiGenerated field!`, {
            hasAiGenerated: !!analysis.aiGenerated,
            analysisKeys: Object.keys(analysis),
          });
        } else {
          logger.info(`PR #${pr.number} has aiGenerated data`, {
            probability: analysis.aiGenerated.probability,
            confidence: analysis.aiGenerated.confidence,
          });
        }

        // Save analysis to database
        await prisma.pRAnalysisRecord.upsert({
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
            summary: analysis.summary,
            relevance: analysis.relevance,
            category: analysis.category,
            impact: analysis.impact as any,
            filesChanged: analysis.filesChanged as any,
            recommendations: analysis.recommendations as any,
            aiGenerated: analysis.aiGenerated as any,
          },
          update: {
            summary: analysis.summary,
            relevance: analysis.relevance,
            category: analysis.category,
            impact: analysis.impact as any,
            filesChanged: analysis.filesChanged as any,
            recommendations: analysis.recommendations as any,
            aiGenerated: analysis.aiGenerated as any,
          },
        });

        // Update PR record with files count and lastAnalyzedAt
        await prisma.pullRequestRecord.update({
          where: {
            owner_repo_prNumber: {
              owner,
              repo,
              prNumber: pr.number,
            },
          },
          data: {
            filesChangedCount: files.length,
            lastAnalyzedAt: new Date(),
          },
        });

        stats.analyzed++;

        logger.info(`PR #${pr.number} analysis complete`, {
          relevance: analysis.relevance,
          category: analysis.category,
          risk: analysis.impact.risk,
        });
      } catch (error) {
        logger.error(`❌ Failed to analyze PR #${pr.number}`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          prNumber: pr.number,
          prTitle: pr.title,
        });
        stats.failed++;
      }
    }

    // 6) Query all PRs from database with analysis
    logger.info("Fetching results from database");
    const dbPRs = await prisma.pullRequestRecord.findMany({
      where: {
        owner,
        repo,
        state: "open",
      },
      include: {
        analysis: true,
      },
      orderBy: [
        {
          analysis: {
            relevance: "desc",
          },
        },
        {
          prNumber: "desc",
        },
      ],
    });

    // Convert database records to PRWithAnalysis format
    const analyzedPRs: PRWithAnalysis[] = dbPRs.map((dbPR) => ({
      id: Number(dbPR.prId),
      number: dbPR.prNumber,
      title: dbPR.title,
      html_url: dbPR.htmlUrl,
      state: dbPR.state,
      user: {
        login: dbPR.author,
        html_url: `https://github.com/${dbPR.author}`,
      },
      created_at: dbPR.prCreatedAt.toISOString(),
      merged_at: dbPR.mergedAt?.toISOString(),
      body: dbPR.body ?? undefined,
      filesChangedCount: dbPR.filesChangedCount ?? 0,
      analysis: dbPR.analysis
        ? {
            summary: dbPR.analysis.summary,
            relevance: dbPR.analysis.relevance as "high" | "medium" | "low",
            category: dbPR.analysis.category,
            impact: dbPR.analysis.impact as any,
            filesChanged: dbPR.analysis.filesChanged as any,
            recommendations: dbPR.analysis.recommendations as string[],
            aiGenerated: dbPR.analysis.aiGenerated as any,
          }
        : undefined,
    }));

    logger.info("PR triage pipeline complete", {
      totalPRs: prs.length,
      analyzed: stats.analyzed,
      skipped: stats.skipped,
      failed: stats.failed,
    });

    return ok({
      totalPRs: prs.length,
      prs: analyzedPRs,
      stats,
    });
  } catch (error) {
    logger.error("Database error in PR triage pipeline", {
      error: error instanceof Error ? error.message : String(error),
    });
    return err({
      type: "Database",
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
