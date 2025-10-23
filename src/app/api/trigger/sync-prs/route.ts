import { getUser } from "@/echo";
import { syncPRsTask } from "@/trigger/sync-and-bucket-prs";
import { runs } from "@trigger.dev/sdk/v3";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { owner, repo } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "owner and repo are required" },
        { status: 400 }
      );
    }

    // Check for existing running jobs to prevent concurrent execution
    try {
      const activeRuns = await runs.list({
        status: [
          "WAITING_FOR_DEPLOY",
          "QUEUED",
          "EXECUTING",
          "REATTEMPTING",
        ] as any,
        tag: [owner, repo], // Filter by repository tags
      } as any);

      const hasRunningJob = activeRuns.data.some((run: any) =>
        run.taskIdentifier === "sync-prs" ||
        run.taskIdentifier === "sync-and-bucket-prs"
      );

      if (hasRunningJob) {
        return NextResponse.json({
          success: false,
          error: "A sync job is already running for this repository",
          message: "Please wait for the current job to complete before starting a new one",
        }, { status: 409 });
      }
    } catch (checkError) {
      console.warn("Could not check for running jobs, proceeding anyway:", checkError);
    }

    // Trigger the sync task with tags (no idempotency key)
    const handle = await syncPRsTask.trigger({
      owner,
      repo,
      echoUserId: user.id,
    }, {
      tags: [owner, repo, `user:${user.id}`],
    });

    return NextResponse.json({
      success: true,
      taskId: handle.id,
      message: "PR sync task started",
    });
  } catch (error) {
    console.error("Failed to trigger sync task:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to trigger sync task",
      },
      { status: 500 }
    );
  }
}