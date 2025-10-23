import { getUser } from "@/echo";
import { syncPRsTask } from "@/trigger/sync-and-bucket-prs";
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

    // Trigger the sync task
    const handle = await syncPRsTask.trigger({
      owner,
      repo,
      echoUserId: user.id,
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