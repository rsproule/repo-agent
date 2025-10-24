import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from"); // Unix timestamp (seconds)
    const to = searchParams.get("to"); // Unix timestamp (seconds)

    if (!from || !to) {
      return NextResponse.json(
        { error: "from and to timestamps are required" },
        { status: 400 },
      );
    }

    const fromTs = parseInt(from);
    const toTs = parseInt(to);

    // CryptoCompare API returns max 2000 days per call
    // Fetch ALL available ETH price data going back to the beginning
    const pricesByDate: Record<string, number> = {};
    const DAYS_PER_CALL = 2000;
    const SECONDS_PER_DAY = 86400;

    let currentToTs = toTs;
    let fetchCount = 0;
    const maxFetches = 20; // Safety limit (covers ~40,000 days)

    while (fetchCount < maxFetches) {
      const apiUrl = `https://min-api.cryptocompare.com/data/v2/histoday?fsym=ETH&tsym=USD&limit=${DAYS_PER_CALL}&toTs=${currentToTs}`;

      const response = await fetch(apiUrl, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("CryptoCompare API error:", response.status, errorText);
        throw new Error(`CryptoCompare API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.Response !== "Success" || !data.Data?.Data) {
        throw new Error("Invalid response from CryptoCompare");
      }

      // Add ALL prices from this batch (no filtering)
      for (const point of data.Data.Data) {
        const date = new Date(point.time * 1000).toISOString().split("T")[0];
        pricesByDate[date] = point.close;
      }

      // Move backwards in time for next batch
      const oldestTimestamp = data.Data.Data[0]?.time;
      if (!oldestTimestamp || oldestTimestamp >= currentToTs) {
        break;
      }

      // If we've gone far enough back before the requested range, we can stop
      if (oldestTimestamp < fromTs - 365 * SECONDS_PER_DAY) {
        break;
      }

      currentToTs = oldestTimestamp - SECONDS_PER_DAY;
      fetchCount++;

      // Small delay to be nice to the API
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const sortedDates = Object.keys(pricesByDate).sort();
    const oldestDate = sortedDates[0];
    const newestDate = sortedDates[sortedDates.length - 1];

    return NextResponse.json({
      prices: pricesByDate,
      count: Object.keys(pricesByDate).length,
      oldestDate,
      newestDate,
    });
  } catch (error) {
    console.error("ETH price fetch error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch ETH prices",
      },
      { status: 500 },
    );
  }
}
