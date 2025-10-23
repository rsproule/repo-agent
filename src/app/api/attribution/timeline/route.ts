import { getUser } from "@/echo";
import { getAttributionByUser } from "@/lib/attribution";
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
    const maxPrNumber = searchParams.get("maxPrNumber");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "owner and repo are required" },
        { status: 400 },
      );
    }

    if (!maxPrNumber) {
      return NextResponse.json(
        { error: "maxPrNumber is required" },
        { status: 400 },
      );
    }

    // Get top 10 contributors up to the specified PR number
    const result = await getAttributionByUser(
      owner,
      repo,
      1, // page
      10, // pageSize - get top 10
      {}, // postFilters
      { maxPrNumber: parseInt(maxPrNumber) }, // preFilters with maxPrNumber
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Timeline attribution error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch timeline attribution",
      },
      { status: 500 },
    );
  }
}

