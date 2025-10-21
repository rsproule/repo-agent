import { getUser } from "@/echo";
import { getQuartileDetails } from "@/lib/attribution";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: { quartile: string } },
) {
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
    const quartileIndex = parseInt(params.quartile);

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "owner and repo are required" },
        { status: 400 },
      );
    }

    if (isNaN(quartileIndex) || quartileIndex < 0 || quartileIndex > 3) {
      return NextResponse.json(
        { error: "quartile must be between 0 and 3" },
        { status: 400 },
      );
    }

    const result = await getQuartileDetails(
      owner,
      repo,
      quartileIndex,
      page,
      pageSize,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Quartile details error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to get quartile details",
      },
      { status: 500 },
    );
  }
}
