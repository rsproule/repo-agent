import { getUser } from "@/echo";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

interface Params {
  owner: string;
  repo: string;
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

    // Count total merged PRs
    const totalMergedPRs = await prisma.pullRequestRecord.count({
      where: {
        owner,
        repo,
        mergedAt: { not: null },
      },
    });

    // Count PRs with scores
    const scoredPRs = await prisma.prScore.count({
      where: {
        owner,
        repo,
      },
    });

    // Calculate readiness
    const isReady = scoredPRs === totalMergedPRs && totalMergedPRs > 0;
    const coverage =
      totalMergedPRs > 0 ? (scoredPRs / totalMergedPRs) * 100 : 0;

    return NextResponse.json({
      isReady,
      totalMergedPRs,
      scoredPRs,
      unscoredPRs: totalMergedPRs - scoredPRs,
      coverage,
    });
  } catch (error) {
    console.error("Timeline readiness check error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to check timeline readiness",
      },
      { status: 500 },
    );
  }
}
