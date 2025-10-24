import { getUser } from "@/echo";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "owner and repo are required" },
        { status: 400 },
      );
    }

    // Fetch PR scores and pull requests separately to avoid deep nesting
    // which causes "stack depth limit exceeded" on large repos
    const [scores, pullRequests] = await Promise.all([
      prisma.prScore.findMany({
        where: {
          owner,
          repo,
        },
        select: {
          prNumber: true,
          author: true,
          bucket: true,
          score: true,
        },
        orderBy: {
          prNumber: "asc",
        },
      }),
      prisma.pullRequestRecord.findMany({
        where: {
          owner,
          repo,
        },
        select: {
          prNumber: true,
          mergedAt: true,
        },
      }),
    ]);

    // Create a map of PR number to mergedAt
    const mergedAtMap = new Map(
      pullRequests.map((pr) => [pr.prNumber, pr.mergedAt]),
    );

    // Return raw scores with merge dates for client-side calculation
    return NextResponse.json({
      scores: scores.map((s) => ({
        prNumber: s.prNumber,
        author: s.author,
        bucket: s.bucket,
        score: s.score,
        mergedAt: mergedAtMap.get(s.prNumber)?.toISOString() || null,
      })),
    });
  } catch (error) {
    console.error("Timeline scores error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch timeline scores",
      },
      { status: 500 },
    );
  }
}
