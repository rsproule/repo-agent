import { executePRTriagePipeline } from "@/ai/pipelines/pr-triage";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { repository } = body;

    if (!repository) {
      return NextResponse.json(
        { error: "Repository is required (format: owner/repo)" },
        { status: 400 },
      );
    }

    const [owner, repo] = repository.split("/");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Invalid repository format. Use: owner/repo" },
        { status: 400 },
      );
    }

    // Get the first GitHub installation from the database
    const installation = await prisma.githubInstallation.findFirst({
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!installation) {
      return NextResponse.json(
        {
          error:
            "No GitHub installations found. Please install the GitHub App first by visiting /dashboard",
        },
        { status: 404 },
      );
    }

    const echoUserId = installation.echoUserId;

    logger.info("🚀 Directly executing PR triage pipeline", {
      owner,
      repo,
      echoUserId,
      installationId: installation.installationId,
    });

    // Execute the pipeline directly (no Trigger.dev queuing)
    const result = await executePRTriagePipeline(
      owner,
      repo,
      echoUserId,
      logger,
    );

    if (result.isErr()) {
      const errorDetails = {
        type: result.error.type,
        message: result.error.cause.message || "Unknown error",
        ...(result.error.cause.stack && { stack: result.error.cause.stack }),
      };

      logger.error("❌ PR triage pipeline failed", { error: errorDetails });
      return NextResponse.json(
        {
          success: false,
          error: errorDetails,
        },
        { status: 500 },
      );
    }

    logger.info("✅ PR triage completed successfully", {
      totalPRs: result.value.totalPRs,
      stats: result.value.stats,
    });

    return NextResponse.json({
      success: true,
      message: "PR triage completed successfully",
      repository: `${owner}/${repo}`,
      totalPRs: result.value.totalPRs,
      stats: result.value.stats,
      prs: result.value.prs.map((pr) => ({
        number: pr.number,
        title: pr.title,
        author: pr.user.login,
        url: pr.html_url,
        created_at: pr.created_at,
        state: pr.state,
        filesChanged: pr.filesChangedCount || 0,
        analysis: pr.analysis
          ? {
              summary: pr.analysis.summary,
              relevance: pr.analysis.relevance,
              category: pr.analysis.category,
              impact: pr.analysis.impact,
              filesChanged: pr.analysis.filesChanged,
              recommendations: pr.analysis.recommendations,
              aiGenerated: pr.analysis.aiGenerated,
            }
          : undefined,
      })),
    });
  } catch (error) {
    logger.error("❌ Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
