import { getUser } from "@/echo";
import { getQuartiles } from "@/lib/attribution";
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
    const minTime = searchParams.get("minTime");
    const maxTime = searchParams.get("maxTime");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "owner and repo are required" },
        { status: 400 },
      );
    }

    const preFilters: any = {};
    if (minTime) {
      preFilters.minTime = minTime;
    }
    if (maxTime) {
      preFilters.maxTime = maxTime;
    }

    const result = await getQuartiles(owner, repo, preFilters);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Quartiles error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get quartiles",
      },
      { status: 500 },
    );
  }
}
