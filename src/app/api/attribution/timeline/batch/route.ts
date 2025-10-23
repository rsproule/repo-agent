import { getUser } from "@/echo";
import type { UserAttribution } from "@/lib/attribution";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { owner, repo, prNumbers } = body as {
      owner: string;
      repo: string;
      prNumbers: number[];
    };

    if (!owner || !repo || !Array.isArray(prNumbers)) {
      return NextResponse.json(
        { error: "owner, repo, and prNumbers array are required" },
        { status: 400 },
      );
    }

    // Batch process all PR numbers
    const results: Record<number, UserAttribution[]> = {};

    // Build the SQL query that gets attribution for all PR numbers at once
    const query = `
      WITH RECURSIVE
      pr_ranges AS (
        SELECT unnest($3::int[]) as max_pr_number
      ),
      batch_recent AS (
        SELECT
            pr_ranges.max_pr_number,
            ps.author,
            ps.bucket,
            ps.score AS pr_score,
            pr.merged_at AS "mergedAt"
        FROM pr_ranges
        CROSS JOIN pr_scores ps
        JOIN pull_requests pr ON pr.owner = ps.owner AND pr.repo = ps.repo AND pr.pr_number = ps.pr_number
        WHERE ps.owner = $1 AND ps.repo = $2
        AND pr.pr_number <= pr_ranges.max_pr_number
        AND pr.merged_at IS NOT NULL
      ),
      batch_normed AS (
        SELECT
            max_pr_number,
            author,
            bucket,
            pr_score,
            "mergedAt",
            CASE
                WHEN stats.hi > stats.lo
                    THEN (pr_score - stats.lo) / (stats.hi - stats.lo)
                ELSE 0.0
            END AS norm_score
        FROM batch_recent
        CROSS JOIN LATERAL (
          SELECT 
            MIN(pr_score) AS lo, 
            MAX(pr_score) AS hi 
          FROM batch_recent br2 
          WHERE br2.max_pr_number = batch_recent.max_pr_number
        ) stats
      ),
      batch_attributed AS (
        SELECT
            max_pr_number,
            author,
            bucket,
            pr_score,
            "mergedAt",
            GREATEST(norm_score * norm_score, 0.000000001) AS attrib_score
        FROM batch_normed
      ),
      batch_bucket_sums AS (
        SELECT
            max_pr_number,
            bucket,
            SUM(attrib_score) AS bucket_sum,
            COUNT(*) AS bucket_pr_count
        FROM batch_attributed
        GROUP BY max_pr_number, bucket
      ),
      batch_bucket_targets AS (
        SELECT
            bbs.max_pr_number,
            bbs.bucket,
            bbs.bucket_sum,
            bbs.bucket_pr_count,
            CASE
                WHEN total_attrib > 0 THEN bbs.bucket_sum / total_attrib
                ELSE 0.0
            END AS target_pct
        FROM batch_bucket_sums bbs
        CROSS JOIN LATERAL (
          SELECT SUM(attrib_score) as total_attrib 
          FROM batch_attributed ba 
          WHERE ba.max_pr_number = bbs.max_pr_number
        ) ta
      ),
      batch_renormalized AS (
        SELECT
            bt.max_pr_number,
            bt.bucket,
            bt.bucket_sum,
            bt.bucket_pr_count,
            bt.target_pct / NULLIF(sum_target_pct, 0) AS final_bucket_pct
        FROM batch_bucket_targets bt
        CROSS JOIN LATERAL (
          SELECT SUM(target_pct) as sum_target_pct 
          FROM batch_bucket_targets bt2 
          WHERE bt2.max_pr_number = bt.max_pr_number
        ) sums
      ),
      batch_final_attribution AS (
        SELECT
            a.max_pr_number,
            a.author,
            a.bucket,
            a.pr_score,
            a."mergedAt",
            a.attrib_score,
            CASE
                WHEN r.bucket_sum > 0 THEN
                    (a.attrib_score / r.bucket_sum) * r.final_bucket_pct
                WHEN r.bucket_pr_count > 0 THEN
                    r.final_bucket_pct / r.bucket_pr_count
                ELSE 0.0
            END AS pct
        FROM batch_attributed a
        LEFT JOIN batch_renormalized r 
          ON a.bucket = r.bucket 
          AND a.max_pr_number = r.max_pr_number
      )
      SELECT
          max_pr_number,
          author,
          SUM(pct) as total_pct,
          COUNT(*) as pr_count,
          COUNT(CASE WHEN bucket = 0 THEN 1 END) as bucket0_count,
          COUNT(CASE WHEN bucket = 1 THEN 1 END) as bucket1_count,
          COUNT(CASE WHEN bucket = 2 THEN 1 END) as bucket2_count,
          COUNT(CASE WHEN bucket = 3 THEN 1 END) as bucket3_count,
          SUM(CASE WHEN bucket = 0 THEN pct ELSE 0 END) as bucket0_agg_pct,
          SUM(CASE WHEN bucket = 1 THEN pct ELSE 0 END) as bucket1_agg_pct,
          SUM(CASE WHEN bucket = 2 THEN pct ELSE 0 END) as bucket2_agg_pct,
          SUM(CASE WHEN bucket = 3 THEN pct ELSE 0 END) as bucket3_agg_pct
      FROM batch_final_attribution
      GROUP BY max_pr_number, author
      ORDER BY max_pr_number, total_pct DESC
    `;

    const dbResults = await prisma.$queryRawUnsafe<
      Array<{
        max_pr_number: number;
        author: string;
        total_pct: number;
        pr_count: bigint;
        bucket0_count: bigint;
        bucket1_count: bigint;
        bucket2_count: bigint;
        bucket3_count: bigint;
        bucket0_agg_pct: number;
        bucket1_agg_pct: number;
        bucket2_agg_pct: number;
        bucket3_agg_pct: number;
      }>
    >(query, owner, repo, prNumbers);

    // Group results by PR number and take top 10 for each
    for (const prNumber of prNumbers) {
      const prResults = dbResults
        .filter((r) => r.max_pr_number === prNumber)
        .slice(0, 10)
        .map((r) => ({
          userId: r.author,
          pct: Number(r.total_pct),
          bucket0Count: Number(r.bucket0_count),
          bucket1Count: Number(r.bucket1_count),
          bucket2Count: Number(r.bucket2_count),
          bucket3Count: Number(r.bucket3_count),
          bucket0AggPct: Number(r.bucket0_agg_pct),
          bucket1AggPct: Number(r.bucket1_agg_pct),
          bucket2AggPct: Number(r.bucket2_agg_pct),
          bucket3AggPct: Number(r.bucket3_agg_pct),
        }));

      results[prNumber] = prResults;
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Batch timeline attribution error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch batch timeline attribution",
      },
      { status: 500 },
    );
  }
}
