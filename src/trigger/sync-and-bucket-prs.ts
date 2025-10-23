import { bucketPRs } from "@/ai/tools/bucket-prs";
import { syncRepoPRs } from "@/ai/tools/sync-prs";
import { createTriggerLogger } from "@/lib/logger";
import { task, logger as triggerLogger } from "@trigger.dev/sdk/v3";

export const syncPRsTask = task({
  id: "sync-prs",
  maxDuration: 600, // 10 minutes
  run: async (
    payload: {
      owner: string;
      repo: string;
      echoUserId: string;
    },
    { ctx }
  ) => {
    const logger = createTriggerLogger(triggerLogger);
    const { owner, repo, echoUserId } = payload;

    logger.info("Starting PR sync task", { owner, repo, echoUserId });

    const result = await syncRepoPRs(
      {
        owner,
        repo,
        echoUserId,
        pageSize: 100,
        requestDelayMs: 0,
      },
      logger
    );

    if (result.isErr()) {
      const errorMessage = `Sync failed: ${result.error.type} - ${result.error.cause.message}`;
      logger.error("PR sync task failed", { error: result.error });
      throw new Error(errorMessage);
    }

    logger.info("PR sync task completed", {
      totalSynced: result.value.totalSynced,
    });

    return {
      success: true,
      totalSynced: result.value.totalSynced,
      repository: `${owner}/${repo}`,
    };
  },
});

export const bucketPRsTask = task({
  id: "bucket-prs",
  maxDuration: 3600, // 60 minutes for AI processing
  run: async (
    payload: {
      owner: string;
      repo: string;
      echoUserId: string;
      fullResync?: boolean;
    },
    { ctx }
  ) => {
    const logger = createTriggerLogger(triggerLogger);
    const { owner, repo, echoUserId, fullResync = false } = payload;

    logger.info("Starting PR bucketing task", { owner, repo, echoUserId, fullResync });

    const result = await bucketPRs(
      {
        owner,
        repo,
        echoUserId,
        fullResync,
      },
      logger
    );

    logger.info("PR bucketing task completed", {
      totalProcessed: result.totalProcessed,
      totalCost: result.totalCost,
      runId: result.runId,
    });

    return {
      success: true,
      totalProcessed: result.totalProcessed,
      totalCost: result.totalCost,
      runId: result.runId,
      repository: `${owner}/${repo}`,
    };
  },
});

export const syncAndBucketPRsTask = task({
  id: "sync-and-bucket-prs",
  maxDuration: 3600, // 60 minutes total
  run: async (
    payload: {
      owner: string;
      repo: string;
      echoUserId: string;
      fullResync?: boolean;
    },
    { ctx }
  ) => {
    const logger = createTriggerLogger(triggerLogger);
    const { owner, repo, echoUserId, fullResync = false } = payload;

    logger.info("Starting full sync and bucket pipeline", {
      owner, repo, echoUserId, fullResync
    });

    // Step 1: Sync PRs
    logger.info("Step 1: Syncing PRs from GitHub");
    const syncResult = await syncRepoPRs(
      {
        owner,
        repo,
        echoUserId,
        pageSize: 100,
        requestDelayMs: 0,
      },
      logger
    );

    if (syncResult.isErr()) {
      const errorMessage = `Sync failed: ${syncResult.error.type} - ${syncResult.error.cause.message}`;
      logger.error("PR sync failed", { error: syncResult.error });
      throw new Error(errorMessage);
    }

    logger.info("PR sync completed", {
      totalSynced: syncResult.value.totalSynced,
    });

    // Step 2: Bucket PRs
    logger.info("Step 2: Bucketing PRs by complexity/impact");
    const bucketResult = await bucketPRs(
      {
        owner,
        repo,
        echoUserId,
        fullResync,
      },
      logger
    );

    logger.info("PR bucketing completed", {
      totalProcessed: bucketResult.totalProcessed,
      totalCost: bucketResult.totalCost,
      runId: bucketResult.runId,
    });

    return {
      success: true,
      sync: {
        totalSynced: syncResult.value.totalSynced,
      },
      bucket: {
        totalProcessed: bucketResult.totalProcessed,
        totalCost: bucketResult.totalCost,
        runId: bucketResult.runId,
      },
      repository: `${owner}/${repo}`,
    };
  },
});