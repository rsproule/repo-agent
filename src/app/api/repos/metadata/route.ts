import { getUser } from "@/echo";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

    // Get the earliest PR for this repo to determine created_at
    const earliestPr = await prisma.pullRequestRecord.findFirst({
      where: {
        owner: owner,
        repo: repo,
      },
      orderBy: {
        prCreatedAt: 'asc'
      },
      select: {
        prCreatedAt: true,
      }
    });

    const repoMetadata = {
      owner: { login: owner },
      name: repo,
      created_at: earliestPr?.prCreatedAt?.toISOString() || new Date().toISOString(),
    };

    return NextResponse.json(repoMetadata);
  } catch (error) {
    console.error("Repository metadata error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get repository metadata",
      },
      { status: 500 },
    );
  }
}