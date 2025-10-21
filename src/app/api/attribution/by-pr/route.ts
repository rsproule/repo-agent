import { getUser } from "@/echo";
import { getAttributionByPR } from "@/lib/attribution";
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
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const initBucket = searchParams.get("initBucket");
    const userId = searchParams.get("userId");
    const minTime = searchParams.get("minTime");
    const maxTime = searchParams.get("maxTime");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "owner and repo are required" },
        { status: 400 },
      );
    }

    const postFilters: any = {};
    if (initBucket) {
      postFilters.initBucket = parseInt(initBucket);
    }
    if (userId) {
      postFilters.userId = userId;
    }

    const preFilters: any = {};
    if (minTime) {
      preFilters.minTime = minTime;
    }
    if (maxTime) {
      preFilters.maxTime = maxTime;
    }

    const result = await getAttributionByPR(
      owner,
      repo,
      page,
      pageSize,
      postFilters,
      preFilters,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Attribution by PR error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get attribution",
      },
      { status: 500 },
    );
  }
}
