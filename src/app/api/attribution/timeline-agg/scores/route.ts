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
    const reposParam = searchParams.get("repos");

    if (!reposParam) {
      return NextResponse.json(
        { error: "repos parameter is required (format: owner1/repo1,owner2/repo2)" },
        { status: 400 },
      );
    }

    // Parse repos from format: "owner1/repo1,owner2/repo2" or "owner1/repo1:2.0,owner2/repo2:1.5"
    const repos = reposParam.split(",").map((r) => {
      const trimmed = r.trim();
      // Strip weight if present (format: owner/repo:weight)
      const [repoPath] = trimmed.split(":");
      const [owner, repo] = repoPath.split("/");
      return { owner, repo };
    });

    if (repos.some((r) => !r.owner || !r.repo)) {
      return NextResponse.json(
        { error: "Invalid repos format. Use: owner1/repo1,owner2/repo2" },
        { status: 400 },
      );
    }

    console.log(`[Timeline Agg Scores] Fetching scores for ${repos.length} repos:`, 
      repos.map(r => `${r.owner}/${r.repo}`).join(', '));

    // Fetch all PR scores for all repos in one query
    const scores = await prisma.prScore.findMany({
      where: {
        OR: repos.map((r) => ({
          owner: r.owner,
          repo: r.repo,
        })),
      },
      select: {
        prNumber: true,
        author: true,
        bucket: true,
        score: true,
        owner: true,
        repo: true,
      },
      orderBy: [
        { owner: "asc" },
        { repo: "asc" },
        { prNumber: "asc" },
      ],
    });

    console.log(`[Timeline Agg Scores] Found ${scores.length} total scores across all repos`);

    // Count scores per repo for debugging
    const scoreCountsByRepo = scores.reduce((acc, s) => {
      const key = `${s.owner}/${s.repo}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('[Timeline Agg Scores] Scores per repo:', scoreCountsByRepo);

    // Return raw scores for client-side calculation
    return NextResponse.json({
      scores: scores.map((s) => ({
        prNumber: s.prNumber,
        author: s.author,
        bucket: s.bucket,
        score: s.score,
        owner: s.owner,
        repo: s.repo,
      })),
      // Add summary for debugging
      summary: {
        totalScores: scores.length,
        repoCount: repos.length,
        scoreCountsByRepo: scoreCountsByRepo,
      },
    });
  } catch (error) {
    console.error("Timeline aggregated scores error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch timeline aggregated scores",
      },
      { status: 500 },
    );
  }
}

