import { bucketPRs } from "@/ai/tools/bucket-prs";
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
    const { repository, fullResync = false } = body;

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

    // Run the bucketing
    const result = await bucketPRs(
      {
        owner,
        repo,
        echoUserId: user.id,
        fullResync,
      },
      defaultLogger,
    );

    // Get bucket distribution
    const bucketCounts = await prisma.prBucket.groupBy({
      by: ["bucket"],
      where: {
        owner,
        repo,
        runId: result.runId,
      },
      _count: { bucket: true },
    });

    const distribution = {
      bucket0: bucketCounts.find((b) => b.bucket === 0)?._count.bucket || 0,
      bucket1: bucketCounts.find((b) => b.bucket === 1)?._count.bucket || 0,
      bucket2: bucketCounts.find((b) => b.bucket === 2)?._count.bucket || 0,
      bucket3: bucketCounts.find((b) => b.bucket === 3)?._count.bucket || 0,
    };

    return NextResponse.json({
      success: true,
      ...result,
      distribution,
    });
  } catch (error) {
    console.error("PR bucketing error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to bucket PRs",
      },
      { status: 500 },
    );
  }
}
