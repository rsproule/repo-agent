import type { UserAttribution } from "./attribution";

interface PrScore {
  prNumber: number;
  author: string;
  bucket: number;
  score: number;
}

/**
 * Calculate attribution for all PRs up to maxPrNumber
 * This is done client-side for performance
 */
export function calculateTimelineAttribution(
  allScores: PrScore[] | null,
  maxPrNumber: number,
): UserAttribution[] {
  if (!allScores || allScores.length === 0) {
    return [];
  }
  // Filter to PRs up to maxPrNumber
  const relevantScores = allScores.filter((s) => s.prNumber <= maxPrNumber);

  if (relevantScores.length === 0) {
    return [];
  }

  // Normalize scores
  const scores = relevantScores.map((s) => s.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const scoreRange = maxScore - minScore;

  const normalizedScores = relevantScores.map((s) => ({
    ...s,
    normScore: scoreRange > 0 ? (s.score - minScore) / scoreRange : 0,
  }));

  // Calculate attribution scores (squared normalization)
  const attributedScores = normalizedScores.map((s) => ({
    ...s,
    attribScore: Math.max(s.normScore * s.normScore, 0.000000001),
  }));

  // Group by bucket and calculate sums
  const bucketSums: Record<number, { sum: number; count: number }> = {};
  for (const s of attributedScores) {
    if (!bucketSums[s.bucket]) {
      bucketSums[s.bucket] = { sum: 0, count: 0 };
    }
    bucketSums[s.bucket].sum += s.attribScore;
    bucketSums[s.bucket].count += 1;
  }

  const totalAttrib = attributedScores.reduce(
    (sum, s) => sum + s.attribScore,
    0,
  );

  // Calculate bucket percentages
  const bucketPcts: Record<number, number> = {};
  for (const bucket in bucketSums) {
    bucketPcts[bucket] =
      totalAttrib > 0 ? bucketSums[bucket].sum / totalAttrib : 0;
  }

  // Normalize bucket percentages
  const totalBucketPct = Object.values(bucketPcts).reduce(
    (sum, pct) => sum + pct,
    0,
  );
  const normalizedBucketPcts: Record<number, number> = {};
  for (const bucket in bucketPcts) {
    normalizedBucketPcts[bucket] =
      totalBucketPct > 0 ? bucketPcts[bucket] / totalBucketPct : 0;
  }

  // Calculate final attribution for each PR
  const finalAttributions = attributedScores.map((s) => {
    const bucketSum = bucketSums[s.bucket].sum;
    const bucketCount = bucketSums[s.bucket].count;
    const finalBucketPct = normalizedBucketPcts[s.bucket] || 0;

    let pct = 0;
    if (bucketSum > 0) {
      pct = (s.attribScore / bucketSum) * finalBucketPct;
    } else if (bucketCount > 0) {
      pct = finalBucketPct / bucketCount;
    }

    return {
      ...s,
      pct,
    };
  });

  // Group by author
  const authorData: Record<
    string,
    {
      totalPct: number;
      bucket0Count: number;
      bucket1Count: number;
      bucket2Count: number;
      bucket3Count: number;
      bucket0AggPct: number;
      bucket1AggPct: number;
      bucket2AggPct: number;
      bucket3AggPct: number;
    }
  > = {};

  for (const attr of finalAttributions) {
    if (!authorData[attr.author]) {
      authorData[attr.author] = {
        totalPct: 0,
        bucket0Count: 0,
        bucket1Count: 0,
        bucket2Count: 0,
        bucket3Count: 0,
        bucket0AggPct: 0,
        bucket1AggPct: 0,
        bucket2AggPct: 0,
        bucket3AggPct: 0,
      };
    }

    const data = authorData[attr.author];
    data.totalPct += attr.pct;

    if (attr.bucket === 0) {
      data.bucket0Count++;
      data.bucket0AggPct += attr.pct;
    } else if (attr.bucket === 1) {
      data.bucket1Count++;
      data.bucket1AggPct += attr.pct;
    } else if (attr.bucket === 2) {
      data.bucket2Count++;
      data.bucket2AggPct += attr.pct;
    } else if (attr.bucket === 3) {
      data.bucket3Count++;
      data.bucket3AggPct += attr.pct;
    }
  }

  // Convert to array and sort
  const results: UserAttribution[] = Object.entries(authorData)
    .map(([author, data]) => ({
      userId: author,
      pct: data.totalPct,
      bucket0Count: data.bucket0Count,
      bucket1Count: data.bucket1Count,
      bucket2Count: data.bucket2Count,
      bucket3Count: data.bucket3Count,
      bucket0AggPct: data.bucket0AggPct,
      bucket1AggPct: data.bucket1AggPct,
      bucket2AggPct: data.bucket2AggPct,
      bucket3AggPct: data.bucket3AggPct,
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 10); // Top 10

  return results;
}
