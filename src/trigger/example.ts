import { executePRTriagePipeline } from "@/ai/tools/pipelines/pr-triage";
import { createTriggerLogger } from "@/lib/logger";
import { task, logger as triggerLogger } from "@trigger.dev/sdk/v3";
import "dotenv/config";

export const helloWorldTask = task({
  id: "hello-world",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  run: async (
    payload: {
      repository?: string;
      echoUserId?: string;
      githubToken?: string;
    },
    { ctx },
  ) => {
    // Wrap Trigger.dev logger with our Logger interface
    const logger = createTriggerLogger(triggerLogger);

    logger.info("Starting PR Triage task", { payload });

    // Debug: Check if DATABASE_URL is accessible
    const hasDbUrl = !!process.env.DATABASE_URL;
    logger.info("Environment check", {
      hasDatabaseUrl: hasDbUrl,
      nodeEnv: process.env.NODE_ENV,
    });

    // Parse repository from payload or use default
    const [owner, repo] = (payload.repository || "merit-systems/echo").split(
      "/",
    );
    const echoUserId = payload.echoUserId || "85618532";

    logger.info("Executing PR triage pipeline", { owner, repo, echoUserId });

    const result = await executePRTriagePipeline(
      owner,
      repo,
      echoUserId,
      logger,
    );

    if (result.isErr()) {
      logger.error("PR triage pipeline failed", { error: result.error });
      throw new Error(`Pipeline failed: ${result.error.type}`);
    }

    logger.info("PR triage completed successfully", {
      totalPRs: result.value.totalPRs,
      prs: result.value.prs.map((pr) => ({
        number: pr.number,
        title: pr.title,
        author: pr.user.login,
      })),
    });

    return {
      message: "PR triage completed",
      totalPRs: result.value.totalPRs,
      repository: `${owner}/${repo}`,
    };
  },
});
