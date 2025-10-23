import { getUser } from "@/echo";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface PrTimeBucket {
  bucket_start: Date;
  bucket_end: Date;
  pr_count: number;
}

interface QueryPeriod {
  start: Date;
  end: Date;
  window: 'day' | 'week' | 'month';
}

interface PrAggregationResponse {
  buckets: PrTimeBucket[];
  total_prs: number;
  query_period: QueryPeriod;
}

export async function GET(req: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");
    const startWindow = searchParams.get("start_window");
    const endWindow = searchParams.get("end_window");
    const window = searchParams.get("window") || 'week';

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "owner and repo are required" },
        { status: 400 },
      );
    }

    // If no start time provided, get the earliest PR merge date
    let start: Date;
    const end = endWindow ? new Date(endWindow) : new Date();

    if (startWindow) {
      start = new Date(startWindow);
    } else {
      // Find the earliest merged PR for this repo
      const earliestPr = await prisma.pullRequestRecord.findFirst({
        where: {
          owner: owner,
          repo: repo,
          mergedAt: {
            not: null
          }
        },
        orderBy: {
          mergedAt: 'asc'
        },
        select: {
          mergedAt: true
        }
      });

      start = earliestPr?.mergedAt || new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000); // fallback to 1 year ago
    }

    // Validate window parameter
    if (!['day', 'week', 'month'].includes(window)) {
      return NextResponse.json(
        { error: "window must be 'day', 'week', or 'month'" },
        { status: 400 },
      );
    }

    // Query PRs with time bucketing using PostgreSQL date_trunc
    let query: string;
    if (window === 'day') {
      query = `
        WITH time_buckets AS (
          SELECT
            date_trunc('day', merged_at) as bucket_start,
            (date_trunc('day', merged_at) + interval '1 day') as bucket_end,
            COUNT(*) as pr_count
          FROM "pull_requests"
          WHERE owner = $1
          AND repo = $2
          AND merged_at IS NOT NULL
          AND merged_at >= $3
          AND merged_at <= $4
          GROUP BY bucket_start, bucket_end
          ORDER BY bucket_start
        )
        SELECT bucket_start, bucket_end, pr_count FROM time_buckets
      `;
    } else if (window === 'week') {
      query = `
        WITH time_buckets AS (
          SELECT
            date_trunc('week', merged_at) as bucket_start,
            (date_trunc('week', merged_at) + interval '1 week') as bucket_end,
            COUNT(*) as pr_count
          FROM "pull_requests"
          WHERE owner = $1
          AND repo = $2
          AND merged_at IS NOT NULL
          AND merged_at >= $3
          AND merged_at <= $4
          GROUP BY bucket_start, bucket_end
          ORDER BY bucket_start
        )
        SELECT bucket_start, bucket_end, pr_count FROM time_buckets
      `;
    } else {
      query = `
        WITH time_buckets AS (
          SELECT
            date_trunc('month', merged_at) as bucket_start,
            (date_trunc('month', merged_at) + interval '1 month') as bucket_end,
            COUNT(*) as pr_count
          FROM "pull_requests"
          WHERE owner = $1
          AND repo = $2
          AND merged_at IS NOT NULL
          AND merged_at >= $3
          AND merged_at <= $4
          GROUP BY bucket_start, bucket_end
          ORDER BY bucket_start
        )
        SELECT bucket_start, bucket_end, pr_count FROM time_buckets
      `;
    }

    const result = await prisma.$queryRawUnsafe<Array<{
      bucket_start: Date;
      bucket_end: Date;
      pr_count: bigint;
    }>>(query, owner, repo, start, end);

    // Convert bigint to number for JSON serialization
    const buckets: PrTimeBucket[] = result.map(row => ({
      bucket_start: row.bucket_start,
      bucket_end: row.bucket_end,
      pr_count: Number(row.pr_count),
    }));

    const totalPrs = buckets.reduce((sum, bucket) => sum + bucket.pr_count, 0);

    const response: PrAggregationResponse = {
      buckets,
      total_prs: totalPrs,
      query_period: {
        start,
        end,
        window: window as 'day' | 'week' | 'month',
      },
    };


    return NextResponse.json(response);
  } catch (error) {
    console.error("PR aggregation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get PR aggregation",
      },
      { status: 500 },
    );
  }
}