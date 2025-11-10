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

    console.log(`[Timeline Agg] Fetching PRs for ${repos.length} repos:`, 
      repos.map(r => `${r.owner}/${r.repo}`).join(', '));

    // Get all merged PRs across all repos, sorted chronologically by merge time
    // This creates a unified timeline where PRs from different repos are interleaved
    // based on when they were actually merged (the x-axis is time, not repo)
    const mergedPRs = await prisma.pullRequestRecord.findMany({
      where: {
        OR: repos.map((r) => ({
          owner: r.owner,
          repo: r.repo,
        })),
        mergedAt: { not: null },
      },
      select: {
        prNumber: true,
        mergedAt: true,
        owner: true,
        repo: true,
      },
      orderBy: {
        mergedAt: "asc", // CRITICAL: Sort by merge time across ALL repos
      },
    });

    console.log(`[Timeline Agg] Found ${mergedPRs.length} total merged PRs across all repos`);

    if (mergedPRs.length === 0) {
      return NextResponse.json(
        { error: "No merged PRs found" },
        { status: 404 },
      );
    }

    // Count PRs per repo for debugging
    const prCountsByRepo = mergedPRs.reduce((acc, pr) => {
      const key = `${pr.owner}/${pr.repo}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('[Timeline Agg] PRs per repo:', prCountsByRepo);

    // Create a global sequence number for each PR based on chronological merge time
    // Sequence 1 = earliest merged PR (across all repos)
    // Sequence N = most recent merged PR (across all repos)
    const prSequence = mergedPRs.map((pr, index) => ({
      sequenceNumber: index + 1,
      owner: pr.owner,
      repo: pr.repo,
      prNumber: pr.prNumber,
      mergedAt: pr.mergedAt,
    }));

    return NextResponse.json({
      minSequenceNumber: 1,
      maxSequenceNumber: prSequence.length,
      prSequence: prSequence,
      totalCount: prSequence.length,
      // Add summary for debugging
      summary: {
        totalPRs: prSequence.length,
        repoCount: repos.length,
        prCountsByRepo: prCountsByRepo,
        dateRange: {
          earliest: mergedPRs[0]?.mergedAt,
          latest: mergedPRs[mergedPRs.length - 1]?.mergedAt,
        },
      },
    });
  } catch (error) {
    console.error("PR range aggregation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch aggregated PR range",
      },
      { status: 500 },
    );
  }
}

