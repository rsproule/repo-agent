import { syncRepoPRs } from "@/ai/tools/sync-prs";
import { getUser } from "@/echo";
import { prisma } from "@/lib/db";
import { defaultLogger } from "@/lib/logger";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { repository } = body;

    if (!repository || typeof repository !== "string") {
      return NextResponse.json(
        { error: "Repository is required (format: owner/repo)" },
        { status: 400 },
      );
    }

    const [owner, repo] = repository.split("/");
    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Invalid repository format. Expected: owner/repo" },
        { status: 400 },
      );
    }

    // Run the sync
    const syncResult = await syncRepoPRs(
      {
        owner,
        repo,
        echoUserId: user.id,
        pageSize: 100,
        requestDelayMs: 0,
      },
      defaultLogger,
    );

    if (syncResult.isErr()) {
      const error = syncResult.error;
      return NextResponse.json(
        {
          error: `Sync failed (${error.type}): ${error.cause.message}`,
        },
        { status: 500 },
      );
    }

    const result = syncResult.value;

    // Get current table stats for this repo
    const stats = await prisma.pullRequestRecord.groupBy({
      by: ["state"],
      where: { owner, repo },
      _count: { state: true },
    });

    const total = await prisma.pullRequestRecord.count({
      where: { owner, repo },
    });

    return NextResponse.json({
      success: true,
      totalSynced: result.totalSynced,
      tableStats: {
        total,
        open: stats.find((s) => s.state === "open")?._count.state || 0,
        closed: stats.find((s) => s.state === "closed")?._count.state || 0,
        merged: stats.find((s) => s.state === "merged")?._count.state || 0,
      },
      latestPR: result.latestPR
        ? {
            number: result.latestPR.number,
            title: result.latestPR.title,
            author: result.latestPR.user?.login || "unknown",
            url: result.latestPR.html_url,
          }
        : undefined,
    });
  } catch (error) {
    console.error("PR sync error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to sync PRs",
      },
      { status: 500 },
    );
  }
}
