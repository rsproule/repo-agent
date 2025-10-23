import { getUser } from "@/echo";
import { syncAndBucketPRsTask } from "@/trigger/sync-and-bucket-prs";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { owner, repo, fullResync = false } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "owner and repo are required" },
        { status: 400 }
      );
    }

    // Trigger the full sync and bucket task
    const handle = await syncAndBucketPRsTask.trigger({
      owner,
      repo,
      echoUserId: user.id,
      fullResync,
    });

    return NextResponse.json({
      success: true,
      taskId: handle.id,
      message: "Sync and bucket task started",
    });
  } catch (error) {
    console.error("Failed to trigger sync and bucket task:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to trigger task",
      },
      { status: 500 }
    );
  }
}