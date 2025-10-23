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
  tags?: string[];
  createdAt?: Date;
  completedAt?: Date;
  finishedAt?: Date;
}

export async function GET(
  _request: Request,
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

    try {
      // Get runs filtered by tags - this uses the tags we set when triggering
      const activeRuns = await runs.list({
        status: [
          "WAITING_FOR_DEPLOY",
          "QUEUED",
          "EXECUTING",
          "REATTEMPTING",
        ] as any,
        tag: [owner, repo], // Filter by repository tags
      } as any);

      const completedRuns = await runs.list({
        status: ["COMPLETED", "FAILED"] as any,
        tag: [owner, repo], // Filter by repository tags
        limit: 10, // Get recent completed runs
      } as any);

      // Map active runs to job format
      const currentJobs = activeRuns.data.map((run) => {
        const triggerRun = run as TriggerRun;
        return {
          id: run.id,
          jobType: triggerRun.taskIdentifier as
            | "sync-prs"
            | "bucket-prs"
            | "sync-and-bucket-prs",
          status: mapTriggerStatus(run.status),
          startedAt: triggerRun.createdAt?.toISOString() || new Date().toISOString(),
          progress: run.status === "EXECUTING"
            ? { current: 1, total: 1, stage: "processing" }
            : undefined,
        };
      });

      const isRunning = currentJobs.length > 0;

      // Find most recent completed run
      const latestCompletedRun = completedRuns.data[0] as TriggerRun | undefined;

      // Determine data freshness
      let dataFreshness: "fresh" | "stale" | "unknown" = "unknown";

      if (isRunning) {
        dataFreshness = "fresh"; // Data is being updated
      } else if (latestCompletedRun) {
        const completedTime = latestCompletedRun.completedAt || latestCompletedRun.finishedAt;
        if (completedTime) {
          const hoursSinceCompletion = (Date.now() - completedTime.getTime()) / (1000 * 60 * 60);
          dataFreshness = hoursSinceCompletion < 24 ? "fresh" : "stale";
        }
      }

      const response = {
        currentJobs,
        isRunning,
        lastSuccessfulSync: latestCompletedRun?.status === "COMPLETED"
          ? (latestCompletedRun.completedAt || latestCompletedRun.finishedAt)?.toISOString()
          : undefined,
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

function mapTriggerStatus(status: string): "waiting" | "queued" | "executing" | "completed" | "failed" {
  switch (status) {
    case "WAITING_FOR_DEPLOY":
      return "waiting";
    case "QUEUED":
      return "queued";
    case "EXECUTING":
    case "REATTEMPTING":
      return "executing";
    case "COMPLETED":
      return "completed";
    case "FAILED":
    case "CANCELED":
    case "CRASHED":
    case "INTERRUPTED":
    case "SYSTEM_FAILURE":
    case "EXPIRED":
      return "failed";
    default:
      return "queued";
  }
}