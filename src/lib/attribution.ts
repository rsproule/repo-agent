import { prisma } from "@/lib/db";

export interface AttributionPreFilters {
  filterIds?: string[];
  minTime?: string;
  maxTime?: string;
}

export interface AttributionOverrides {
  aggBucketPct?: [number, number, number, number];
}

export interface AttributionPostFilters {
  userId?: string;
  minPct?: number;
  maxPct?: number;
  initBucket?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

export interface UserAttribution {
  userId: string;
  pct: number;
  bucket0Count: number;
  bucket1Count: number;
  bucket2Count: number;
  bucket3Count: number;
  bucket0AggPct: number;
  bucket1AggPct: number;
  bucket2AggPct: number;
  bucket3AggPct: number;
}

export interface PRAttribution {
  userId: string;
  prId: number;
  prNumber: number;
  owner: string;
  repo: string;
  pct: number;
  initBucket: number;
  prScore: number;
  title?: string;
  author?: string;
  mergedAt?: Date;
}

export interface Quartile {
  quartileIndex: number;
  count: number;
  aggregatePct: number;
  minPct: number;
  maxPct: number;
}

// Get attribution grouped by user using proper attribution calculations
export async function getAttributionByUser(
  owner: string,
  repo: string,
  page: number = 1,
  pageSize: number = 20,
  postFilters: AttributionPostFilters = {},
  preFilters: AttributionPreFilters = {},
  overrides: AttributionOverrides = {},
): Promise<PaginatedResponse<UserAttribution>> {
  const offset = (page - 1) * pageSize;

  // Build time filter conditions
  const timeFilters: string[] = [];
  if (preFilters.minTime) {
    timeFilters.push(`pr.merged_at >= '${preFilters.minTime}'::timestamptz`);
  }
  if (preFilters.maxTime) {
    timeFilters.push(`pr.merged_at <= '${preFilters.maxTime}'::timestamptz`);
  }
  const timeCondition =
    timeFilters.length > 0 ? `AND ${timeFilters.join(" AND ")}` : "";

  // Build post filter conditions
  const postFilterConditions: string[] = [];
  if (postFilters.initBucket !== undefined) {
    postFilterConditions.push(`ap.bucket = ${postFilters.initBucket}`);
  }
  if (postFilters.userId) {
    postFilterConditions.push(`ap.author = '${postFilters.userId}'`);
  }
  const postFilterCondition =
    postFilterConditions.length > 0
      ? `AND ${postFilterConditions.join(" AND ")}`
      : "";

  // Implement the attribution pipeline logic in SQL
  const query = `
    WITH
    recent AS (
        SELECT
            ps.author,
            ps.bucket,
            ps.score AS pr_score,
            pr.merged_at AS "mergedAt"
        FROM pr_scores ps
        JOIN pull_requests pr ON pr.owner = ps.owner AND pr.repo = ps.repo AND pr.pr_number = ps.pr_number
        WHERE ps.owner = $1 AND ps.repo = $2
        ${timeCondition}
        AND pr.merged_at IS NOT NULL
    ),
    normed AS (
        SELECT
            author,
            bucket,
            pr_score,
            "mergedAt",
            CASE
                WHEN stats.hi > stats.lo
                    THEN (pr_score - stats.lo) / (stats.hi - stats.lo)
                ELSE 0.0
            END AS norm_score
        FROM recent
        CROSS JOIN (SELECT MIN(pr_score) AS lo, MAX(pr_score) AS hi FROM recent) stats
    ),
    attributed AS (
        SELECT
            author,
            bucket,
            pr_score,
            "mergedAt",
            GREATEST(norm_score * norm_score, 0.000000001) AS attrib_score
        FROM normed
    ),
    bucket_sums AS (
        SELECT
            bucket,
            SUM(attrib_score) AS bucket_sum,
            COUNT(*) AS bucket_pr_count
        FROM attributed
        GROUP BY bucket
    ),
    total_attribution AS (
        SELECT SUM(attrib_score) AS total_attrib
        FROM attributed
    ),
    bucket_targets AS (
        SELECT
            bs.bucket,
            bs.bucket_sum,
            bs.bucket_pr_count,
            CASE
                WHEN ta.total_attrib > 0 THEN bs.bucket_sum / ta.total_attrib
                ELSE 0.0
            END AS target_pct
        FROM bucket_sums bs
        CROSS JOIN total_attribution ta
    ),
    renormalized AS (
        SELECT
            bt.bucket,
            bt.bucket_sum,
            bt.bucket_pr_count,
            bt.target_pct / NULLIF((SELECT SUM(target_pct) FROM bucket_targets), 0) AS final_bucket_pct
        FROM bucket_targets bt
    ),
    final_attribution AS (
        SELECT
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
        FROM attributed a
        LEFT JOIN renormalized r ON a.bucket = r.bucket
    )
    SELECT
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
    FROM final_attribution ap
    WHERE 1=1 ${postFilterCondition}
    GROUP BY author
    ORDER BY total_pct DESC
  `;

  // Get total count first
  const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `
    SELECT COUNT(DISTINCT author)::bigint as count
    FROM (${query}) subq
  `,
    owner,
    repo,
  );

  const totalCount = Number(countResult[0]?.count || 0);

  // Get paginated results
  const results = await prisma.$queryRawUnsafe<
    Array<{
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
  >(`${query} LIMIT ${pageSize} OFFSET ${offset}`, owner, repo);

  const items: UserAttribution[] = results.map((result) => ({
    userId: result.author,
    pct: Number(result.total_pct),
    bucket0Count: Number(result.bucket0_count),
    bucket1Count: Number(result.bucket1_count),
    bucket2Count: Number(result.bucket2_count),
    bucket3Count: Number(result.bucket3_count),
    bucket0AggPct: Number(result.bucket0_agg_pct),
    bucket1AggPct: Number(result.bucket1_agg_pct),
    bucket2AggPct: Number(result.bucket2_agg_pct),
    bucket3AggPct: Number(result.bucket3_agg_pct),
  }));

  return {
    items,
    totalCount,
    page,
    pageSize,
    hasNext: totalCount > page * pageSize,
  };
}

// Get attribution by PR using proper attribution calculations
export async function getAttributionByPR(
  owner: string,
  repo: string,
  page: number = 1,
  pageSize: number = 20,
  postFilters: AttributionPostFilters = {},
  preFilters: AttributionPreFilters = {},
  overrides: AttributionOverrides = {},
): Promise<PaginatedResponse<PRAttribution>> {
  const offset = (page - 1) * pageSize;

  // Build time filter conditions
  const timeFilters: string[] = [];
  if (preFilters.minTime) {
    timeFilters.push(`pr.merged_at >= '${preFilters.minTime}'::timestamptz`);
  }
  if (preFilters.maxTime) {
    timeFilters.push(`pr.merged_at <= '${preFilters.maxTime}'::timestamptz`);
  }
  const timeCondition =
    timeFilters.length > 0 ? `AND ${timeFilters.join(" AND ")}` : "";

  // Build post filter conditions
  const postFilterConditions: string[] = [];
  if (postFilters.initBucket !== undefined) {
    postFilterConditions.push(`ap.bucket = ${postFilters.initBucket}`);
  }
  if (postFilters.userId) {
    postFilterConditions.push(`ap.author = '${postFilters.userId}'`);
  }
  const postFilterCondition =
    postFilterConditions.length > 0
      ? `AND ${postFilterConditions.join(" AND ")}`
      : "";

  // Implement the attribution pipeline logic in SQL
  const query = `
    WITH
    recent AS (
        SELECT
            ps.pr_id AS "prId",
            ps.author,
            ps.bucket,
            ps.score AS pr_score,
            pr.merged_at AS "mergedAt",
            pr.title,
            pr.pr_number AS "prNumber"
        FROM pr_scores ps
        JOIN pull_requests pr ON pr.owner = ps.owner AND pr.repo = ps.repo AND pr.pr_number = ps.pr_number
        WHERE ps.owner = $1 AND ps.repo = $2
        ${timeCondition}
        AND pr.merged_at IS NOT NULL
    ),
    normed AS (
        SELECT
            "prId",
            author,
            bucket,
            pr_score,
            "mergedAt",
            title,
            "prNumber",
            CASE
                WHEN stats.hi > stats.lo
                    THEN (pr_score - stats.lo) / (stats.hi - stats.lo)
                ELSE 0.0
            END AS norm_score
        FROM recent
        CROSS JOIN (SELECT MIN(pr_score) AS lo, MAX(pr_score) AS hi FROM recent) stats
    ),
    attributed AS (
        SELECT
            "prId",
            author,
            bucket,
            pr_score,
            "mergedAt",
            title,
            "prNumber",
            GREATEST(norm_score * norm_score, 0.000000001) AS attrib_score
        FROM normed
    ),
    bucket_sums AS (
        SELECT
            bucket,
            SUM(attrib_score) AS bucket_sum,
            COUNT(*) AS bucket_pr_count
        FROM attributed
        GROUP BY bucket
    ),
    bucket_targets AS (
        SELECT
            bs.bucket,
            bs.bucket_sum,
            bs.bucket_pr_count,
            CASE
                WHEN (SELECT SUM(attrib_score) FROM attributed) > 0
                THEN bs.bucket_sum / (SELECT SUM(attrib_score) FROM attributed)
                ELSE 0.0
            END AS target_pct
        FROM bucket_sums bs
    ),
    renormalized AS (
        SELECT
            bt.bucket,
            bt.bucket_sum,
            bt.bucket_pr_count,
            bt.target_pct / NULLIF((SELECT SUM(target_pct) FROM bucket_targets), 0) AS final_bucket_pct
        FROM bucket_targets bt
    ),
    final_attribution AS (
        SELECT
            a."prId",
            a.author,
            a.bucket,
            a.pr_score,
            a."mergedAt",
            a.title,
            a."prNumber",
            a.attrib_score,
            CASE
                WHEN r.bucket_sum > 0 THEN
                    (a.attrib_score / r.bucket_sum) * r.final_bucket_pct
                WHEN r.bucket_pr_count > 0 THEN
                    r.final_bucket_pct / r.bucket_pr_count
                ELSE 0.0
            END AS pct
        FROM attributed a
        LEFT JOIN renormalized r ON a.bucket = r.bucket
    )
    SELECT *
    FROM final_attribution ap
    WHERE 1=1 ${postFilterCondition}
    ORDER BY pct DESC
  `;

  // Get total count first
  const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `
    SELECT COUNT(*)::bigint as count
    FROM (${query}) subq
  `,
    owner,
    repo,
  );

  const totalCount = Number(countResult[0]?.count || 0);

  // Get paginated results
  const results = await prisma.$queryRawUnsafe<
    Array<{
      prId: bigint;
      author: string;
      bucket: number;
      pr_score: number;
      mergedAt: Date;
      title: string;
      prNumber: number;
      attrib_score: number;
      pct: number;
    }>
  >(`${query} LIMIT ${pageSize} OFFSET ${offset}`, owner, repo);

  const items: PRAttribution[] = results.map((result) => ({
    userId: result.author,
    prId: Number(result.prId),
    prNumber: result.prNumber,
    owner,
    repo,
    pct: Number(result.pct),
    initBucket: result.bucket,
    prScore: Number(result.pr_score),
    title: result.title,
    author: result.author,
    mergedAt: result.mergedAt,
  }));

  return {
    items,
    totalCount,
    page,
    pageSize,
    hasNext: totalCount > page * pageSize,
  };
}

// Get quartile statistics using proper attribution pipeline
export async function getQuartiles(
  owner: string,
  repo: string,
  preFilters: AttributionPreFilters = {},
): Promise<Quartile[]> {
  console.log(
    "DEBUG: Getting quartiles for",
    owner,
    repo,
    "with preFilters:",
    preFilters,
  );

  // Build time filter conditions
  const timeFilters: string[] = [];
  if (preFilters.minTime) {
    timeFilters.push(`pr.merged_at >= '${preFilters.minTime}'::timestamptz`);
  }
  if (preFilters.maxTime) {
    timeFilters.push(`pr.merged_at <= '${preFilters.maxTime}'::timestamptz`);
  }
  const timeCondition =
    timeFilters.length > 0 ? `AND ${timeFilters.join(" AND ")}` : "";

  // Use the same attribution pipeline as user/PR calculations
  const query = `
    WITH
    recent AS (
        SELECT
            ps.author,
            ps.bucket,
            ps.score AS pr_score,
            pr.merged_at AS "mergedAt"
        FROM pr_scores ps
        JOIN pull_requests pr ON pr.owner = ps.owner AND pr.repo = ps.repo AND pr.pr_number = ps.pr_number
        WHERE ps.owner = $1 AND ps.repo = $2
        ${timeCondition}
        AND pr.merged_at IS NOT NULL
    ),
    normed AS (
        SELECT
            author,
            bucket,
            pr_score,
            "mergedAt",
            CASE
                WHEN stats.hi > stats.lo
                    THEN (pr_score - stats.lo) / (stats.hi - stats.lo)
                ELSE 0.0
            END AS norm_score
        FROM recent
        CROSS JOIN (SELECT MIN(pr_score) AS lo, MAX(pr_score) AS hi FROM recent) stats
    ),
    attributed AS (
        SELECT
            author,
            bucket,
            pr_score,
            "mergedAt",
            GREATEST(norm_score * norm_score, 0.000000001) AS attrib_score
        FROM normed
    ),
    bucket_sums AS (
        SELECT
            bucket,
            SUM(attrib_score) AS bucket_sum,
            COUNT(*) AS bucket_pr_count
        FROM attributed
        GROUP BY bucket
    ),
    bucket_targets AS (
        SELECT
            bs.bucket,
            bs.bucket_sum,
            bs.bucket_pr_count,
            CASE
                WHEN (SELECT SUM(attrib_score) FROM attributed) > 0
                THEN bs.bucket_sum / (SELECT SUM(attrib_score) FROM attributed)
                ELSE 0.0
            END AS target_pct
        FROM bucket_sums bs
    ),
    renormalized AS (
        SELECT
            bt.bucket,
            bt.bucket_sum,
            bt.bucket_pr_count,
            bt.target_pct / NULLIF((SELECT SUM(target_pct) FROM bucket_targets), 0) AS final_bucket_pct
        FROM bucket_targets bt
    ),
    final_attribution AS (
        SELECT
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
        FROM attributed a
        LEFT JOIN renormalized r ON a.bucket = r.bucket
    )
    SELECT
        bucket as quartile_index,
        COUNT(*) as count,
        SUM(pct) as aggregate_pct,
        MIN(pct) as min_pct,
        MAX(pct) as max_pct
    FROM final_attribution
    GROUP BY bucket
    ORDER BY bucket
  `;

  const results = await prisma.$queryRawUnsafe<
    Array<{
      quartile_index: number;
      count: bigint;
      aggregate_pct: number;
      min_pct: number;
      max_pct: number;
    }>
  >(query, owner, repo);

  // Create a complete set of 4 quartiles (buckets 0-3) with defaults,
  // then merge in actual data
  const quartiles: Quartile[] = [0, 1, 2, 3].map((index) => ({
    quartileIndex: index,
    count: 0,
    aggregatePct: 0,
    minPct: 0,
    maxPct: 0,
  }));

  // Merge in actual data
  results.forEach((row) => {
    if (row.quartile_index >= 0 && row.quartile_index <= 3) {
      quartiles[row.quartile_index] = {
        quartileIndex: row.quartile_index,
        count: Number(row.count),
        aggregatePct: Number(row.aggregate_pct),
        minPct: Number(row.min_pct),
        maxPct: Number(row.max_pct),
      };
    }
  });

  return quartiles;
}

// Get details for a specific quartile
export async function getQuartileDetails(
  owner: string,
  repo: string,
  quartileIndex: number,
  page: number = 1,
  pageSize: number = 20,
): Promise<{
  quartileIndex: number;
  totalPrCount: number;
  distinctAuthorCount: number;
  minPct: number;
  maxPct: number;
  authors: PaginatedResponse<{ userId: string; prCount: number }>;
}> {
  const offset = (page - 1) * pageSize;

  // Get stats for this quartile
  const [prCount, scoreStats, distinctAuthors] = await Promise.all([
    prisma.prBucket.count({
      where: {
        owner,
        repo,
        bucket: quartileIndex,
      },
    }),
    prisma.prScore.aggregate({
      where: {
        owner,
        repo,
        bucket: quartileIndex,
      },
      _min: {
        score: true,
      },
      _max: {
        score: true,
      },
    }),
    prisma.prScore.groupBy({
      by: ["author"],
      where: {
        owner,
        repo,
        bucket: quartileIndex,
      },
      _count: {
        _all: true,
      },
    }),
  ]);

  const authorsList = distinctAuthors
    .sort((a, b) => b._count._all - a._count._all)
    .slice(offset, offset + pageSize)
    .map((a) => ({
      userId: a.author,
      prCount: a._count._all,
    }));

  return {
    quartileIndex,
    totalPrCount: prCount,
    distinctAuthorCount: distinctAuthors.length,
    minPct: scoreStats._min.score || 0,
    maxPct: scoreStats._max.score || 0,
    authors: {
      items: authorsList,
      totalCount: distinctAuthors.length,
      page,
      pageSize,
      hasNext: distinctAuthors.length > page * pageSize,
    },
  };
}
