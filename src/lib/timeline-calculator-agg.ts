import type { UserAttribution } from "./attribution";

interface PrScore {
  prNumber: number;
  author: string;
  bucket: number;
  score: number;
  owner: string;
  repo: string;
}

interface PrSequenceItem {
  sequenceNumber: number;
  owner: string;
  repo: string;
  prNumber: number;
  mergedAt: string | null;
}

interface RepoWeight {
  owner: string;
  repo: string;
  weight: number;
}

/**
 * Calculate attribution for all PRs up to maxSequenceNumber across multiple repos
 * 
 * IMPORTANT: The prSequence is already sorted by merge time (chronologically across all repos).
 * This means the x-axis is time, not repository. PRs from different repos are interleaved
 * based on their actual merge timestamp.
 * 
 * This is done client-side for performance.
 */
export function calculateTimelineAttributionAgg(
  allScores: PrScore[] | null,
  prSequence: PrSequenceItem[],
  maxSequenceNumber: number,
  repoWeights?: RepoWeight[],
): UserAttribution[] {
  if (!allScores || allScores.length === 0 || !prSequence) {
    return [];
  }

  // Get all PRs up to the given sequence number (which represents a point in time)
  // This includes PRs from ALL repos that were merged before that point in time
  const relevantPrSequence = prSequence.filter(
    (s) => s.sequenceNumber <= maxSequenceNumber,
  );

  if (relevantPrSequence.length === 0) {
    return [];
  }

  // Create a set of relevant PR identifiers
  const relevantPrSet = new Set(
    relevantPrSequence.map((s) => `${s.owner}/${s.repo}/${s.prNumber}`),
  );

  // Create a map of repo weights for quick lookup
  const weightMap = new Map<string, number>();
  if (repoWeights) {
    repoWeights.forEach(({ owner, repo, weight }) => {
      weightMap.set(`${owner}/${repo}`, weight);
    });
  }

  console.log('[Timeline Calculator] Weight map:', Object.fromEntries(weightMap));
  console.log('[Timeline Calculator] Total scores before filtering:', allScores.length);

  // First, filter to get relevant scores
  const filteredScores = allScores.filter((s) => 
    relevantPrSet.has(`${s.owner}/${s.repo}/${s.prNumber}`)
  );

  // Find the global minimum score to shift all scores to be positive
  const globalMinScore = Math.min(...filteredScores.map((s) => s.score));
  const scoreShift = globalMinScore < 0 ? Math.abs(globalMinScore) : 0;
  
  console.log(`[Timeline Calculator] Global min score: ${globalMinScore.toFixed(2)}, shift: ${scoreShift.toFixed(2)}`);

  // Shift scores to be positive, then apply weights
  let logCount = 0;
  const relevantScores = filteredScores.map((s) => {
    const repoKey = `${s.owner}/${s.repo}`;
    const weight = weightMap.get(repoKey) ?? 1.0;
    const originalScore = s.score;
    const shiftedScore = s.score + scoreShift; // Shift to positive
    const weightedScore = shiftedScore * weight; // Apply weight
    
    // Log first few to debug
    if (logCount < 5) {
      console.log(`[Timeline Calculator] ${repoKey} PR#${s.prNumber}: score ${originalScore.toFixed(2)} → ${shiftedScore.toFixed(2)} × ${weight} = ${weightedScore.toFixed(2)}`);
      logCount++;
    }
    
    return {
      ...s,
      score: weightedScore, // Use weighted score for attribution
    };
  });

  if (relevantScores.length === 0) {
    console.log('[Timeline Calculator] No relevant scores found');
    return [];
  }

  console.log('[Timeline Calculator] Relevant scores after filtering:', relevantScores.length);

  // Group scores by repo to show distribution
  const scoresByRepo: Record<string, number[]> = {};
  relevantScores.forEach((s) => {
    const key = `${s.owner}/${s.repo}`;
    if (!scoresByRepo[key]) scoresByRepo[key] = [];
    scoresByRepo[key].push(s.score);
  });
  
  console.log('[Timeline Calculator] Score ranges by repo (after weighting):');
  Object.entries(scoresByRepo).forEach(([repo, scores]) => {
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    console.log(`  ${repo}: min=${min.toFixed(2)}, max=${max.toFixed(2)}, avg=${avg.toFixed(2)}, count=${scores.length}`);
  });

  // Normalize scores across ALL repos (this is where weights have their effect)
  const scores = relevantScores.map((s) => s.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const scoreRange = maxScore - minScore;

  console.log(`[Timeline Calculator] Global score range: ${minScore.toFixed(2)} to ${maxScore.toFixed(2)}`);

  const normalizedScores = relevantScores.map((s) => ({
    ...s,
    normScore: scoreRange > 0 ? (s.score - minScore) / scoreRange : 0,
  }));
  
  // Show normalized distribution by repo
  const normScoresByRepo: Record<string, number[]> = {};
  normalizedScores.forEach((s) => {
    const key = `${s.owner}/${s.repo}`;
    if (!normScoresByRepo[key]) normScoresByRepo[key] = [];
    normScoresByRepo[key].push(s.normScore);
  });
  
  console.log('[Timeline Calculator] Normalized score ranges by repo (0-1):');
  Object.entries(normScoresByRepo).forEach(([repo, scores]) => {
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    console.log(`  ${repo}: min=${min.toFixed(3)}, max=${max.toFixed(3)}, avg=${avg.toFixed(3)}`);
  });

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

  console.log('[Timeline Calculator] Top 10 contributors:');
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.userId}: ${(r.pct * 100).toFixed(2)}%`);
  });

  return results;
}

