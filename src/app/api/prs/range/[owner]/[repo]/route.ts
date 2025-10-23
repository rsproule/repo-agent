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

    // Get min and max PR numbers for this repo
    const result = await prisma.pullRequestRecord.aggregate({
      where: {
        owner,
        repo,
        mergedAt: { not: null }, // Only consider merged PRs
      },
      _min: {
        prNumber: true,
      },
      _max: {
        prNumber: true,
      },
    });

    // Get all unique PR numbers (accounting for gaps)
    const prNumbers = await prisma.pullRequestRecord.findMany({
      where: {
        owner,
        repo,
        mergedAt: { not: null },
      },
      select: {
        prNumber: true,
      },
      orderBy: {
        prNumber: "asc",
      },
    });

    return NextResponse.json({
      minPrNumber: result._min.prNumber || 1,
      maxPrNumber: result._max.prNumber || 1,
      prNumbers: prNumbers.map((pr) => pr.prNumber),
      totalCount: prNumbers.length,
    });
  } catch (error) {
    console.error("PR range error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch PR range",
      },
      { status: 500 },
    );
  }
}
