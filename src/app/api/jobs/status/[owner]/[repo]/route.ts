import { getUser } from "@/echo";
import { runs } from "@trigger.dev/sdk/v3";
import { NextResponse } from "next/server";

interface Params {
  owner: string;
  repo: string;
}

interface TriggerRun {
  id: string;
  status: string;
  taskIdentifier?: string;
  payload?: {
    owner?: string;
    repo?: string;
  };
  createdAt?: Date;
  completedAt?: Date;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { owner, repo } = await params;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "owner and repo are required" },
        { status: 400 },
      );
    }

    const repository = `${owner}/${repo}`;

    try {
      // Get recent runs for the sync and bucket tasks (only active ones)
      const recentRuns = await runs.list({
        status: ["WAITING_FOR_DEPLOY", "QUEUED", "EXECUTING", "REATTEMPTING"],
      });

      // Filter runs that are sync/bucket related - ONLY match if we can verify the repo
      const relevantRuns = recentRuns.data.filter((run) => {
        const triggerRun = run as TriggerRun;
        const taskId = triggerRun.taskIdentifier;
        const isRelevantTask =
          taskId === "sync-prs" ||
          taskId === "bucket-prs" ||
          taskId === "sync-and-bucket-prs";

        if (!isRelevantTask) return false;

        const payload = triggerRun.payload;
        if (payload && payload.owner && payload.repo) {
          const runRepo = `${payload.owner}/${payload.repo}`;
          const isRepoMatch = runRepo === repository;
          return isRepoMatch;
        }

        // If no payload or missing owner/repo, we can't verify this is for the right repo
        // Return false to avoid showing jobs from other repos
        return false;
      });

      const isRunning = relevantRuns.length > 0;

      // Get completed runs for freshness check
      const completedRuns = await runs.list({
        status: ["COMPLETED"],
      });

      const recentCompletedRuns = completedRuns.data.filter((run) => {
        const triggerRun = run as TriggerRun;
        const payload = triggerRun.payload;
        if (!payload) return false;
        const runRepo = `${payload?.owner}/${payload?.repo}`;
        const taskId = triggerRun.taskIdentifier;
        return (
          runRepo === repository &&
          (taskId === "sync-prs" ||
            taskId === "bucket-prs" ||
            taskId === "sync-and-bucket-prs")
        );
      });

      const latestCompletedRun = recentCompletedRuns[0];

      // Determine data freshness
      let dataFreshness: "fresh" | "stale" | "unknown" = "unknown";

      if (isRunning) {
        dataFreshness = "fresh"; // Data is being updated
      } else if (
        latestCompletedRun &&
        (latestCompletedRun as TriggerRun).completedAt
      ) {
        const hoursSinceCompletion =
          (Date.now() -
            (latestCompletedRun as TriggerRun).completedAt!.getTime()) /
          (1000 * 60 * 60);
        dataFreshness = hoursSinceCompletion < 24 ? "fresh" : "stale";
      }

      const currentJobs = relevantRuns.map((run) => {
        const triggerRun = run as TriggerRun;
        return {
          id: run.id,
          jobType: triggerRun.taskIdentifier as
            | "sync-prs"
            | "bucket-prs"
            | "sync-and-bucket-prs",
          status: run.status.toLowerCase() as
            | "waiting"
            | "queued"
            | "executing"
            | "completed"
            | "failed",
          startedAt:
            triggerRun.createdAt?.toISOString() || new Date().toISOString(),
          progress:
            run.status === "EXECUTING"
              ? { current: 1, total: 1, stage: "processing" }
              : undefined,
        };
      });

      const response = {
        currentJobs,
        isRunning,
        lastSuccessfulSync: (
          latestCompletedRun as TriggerRun
        )?.completedAt?.toISOString(),
        dataFreshness,
        latestJobStatus: latestCompletedRun?.status?.toLowerCase() || null,
      };

      return NextResponse.json(response);
    } catch (triggerError) {
      console.warn(
        "Failed to fetch Trigger.dev runs, returning basic status:",
        triggerError,
      );

      // Fallback: return basic status without Trigger.dev integration
      return NextResponse.json({
        currentJobs: [],
        isRunning: false,
        lastSuccessfulSync: undefined,
        dataFreshness: "unknown" as const,
        latestJobStatus: null,
      });
    }
  } catch (error) {
    console.error("Job status error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get job status",
      },
      { status: 500 },
    );
  }
}
