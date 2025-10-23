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

    // Fetch all PR scores for the repo in one query
    const scores = await prisma.prScore.findMany({
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
    });

    // Return raw scores for client-side calculation
    return NextResponse.json({
      scores: scores.map((s) => ({
        prNumber: s.prNumber,
        author: s.author,
        bucket: s.bucket,
        score: s.score,
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
