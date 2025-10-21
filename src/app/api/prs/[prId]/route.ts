import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface PullRequest {
  id: number;
  number: number;
  title: string;
  user: {
    login: string;
    avatar_url: string;
  };
  additions?: number;
  deletions?: number;
  state: string;
  html_url: string;
  body?: string;
  created_at: string;
  updated_at: string;
  merged_at?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { prId: string } }
) {
  try {
    const { prId } = params;

    if (!prId) {
      return NextResponse.json(
        { error: "Missing required parameter: prId" },
        { status: 400 }
      );
    }

    // Convert prId to BigInt for database query
    const prIdBigInt = BigInt(prId);

    const pr = await prisma.pullRequestRecord.findFirst({
      where: {
        prId: prIdBigInt,
      },
    });

    if (!pr) {
      return NextResponse.json(
        { error: "Pull request not found" },
        { status: 404 }
      );
    }

    // Transform the data to match the expected format
    const pullRequest: PullRequest = {
      id: Number(pr.prId),
      number: pr.prNumber,
      title: pr.title,
      user: {
        login: pr.author,
        avatar_url: `https://github.com/${pr.author}.png`,
      },
      additions: undefined, // Would need to fetch from GitHub API or store separately
      deletions: undefined, // Would need to fetch from GitHub API or store separately
      state: pr.state,
      html_url: pr.htmlUrl,
      body: pr.body,
      created_at: pr.prCreatedAt.toISOString(),
      updated_at: pr.prUpdatedAt.toISOString(),
      merged_at: pr.mergedAt?.toISOString(),
    };

    return NextResponse.json(pullRequest);

  } catch (error) {
    console.error("Error fetching PR:", error);
    return NextResponse.json(
      { error: "Failed to fetch pull request" },
      { status: 500 }
    );
  }
}