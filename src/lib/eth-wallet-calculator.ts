interface PrScore {
  prNumber: number;
  author: string;
  bucket: number;
  score: number;
  mergedAt: string | null;
}

interface EthPrices {
  [date: string]: number; // YYYY-MM-DD -> USD price
}

export interface WalletBalance {
  author: string;
  totalEth: number;
  totalUsd: number;
  bucket0Eth: number;
  bucket1Eth: number;
  bucket2Eth: number;
  bucket3Eth: number;
}

export const DEFAULT_BUCKET_REWARDS_USD = {
  0: 0.01, // Low
  1: 0.1, // Medium
  2: 0.3, // High
  3: 0.8, // Exceptional
};

export interface BucketRewards {
  0: number;
  1: number;
  2: number;
  3: number;
}

/**
 * Calculate ETH wallet balances for all contributors up to maxPrNumber
 */
export function calculateWalletBalances(
  allScores: PrScore[],
  ethPrices: EthPrices,
  maxPrNumber: number,
  currentEthPrice: number,
  bucketRewards: BucketRewards = DEFAULT_BUCKET_REWARDS_USD,
): Record<string, WalletBalance> {
  // Filter to PRs up to maxPrNumber
  const relevantScores = allScores.filter((s) => s.prNumber <= maxPrNumber);

  const wallets: Record<string, WalletBalance> = {};

  // Get the first available ETH price (earliest date) as fallback for old PRs
  const sortedDates = Object.keys(ethPrices).sort();
  const firstAvailablePrice =
    sortedDates.length > 0 ? ethPrices[sortedDates[0]] : currentEthPrice;

  for (const score of relevantScores) {
    if (!wallets[score.author]) {
      wallets[score.author] = {
        author: score.author,
        totalEth: 0,
        totalUsd: 0,
        bucket0Eth: 0,
        bucket1Eth: 0,
        bucket2Eth: 0,
        bucket3Eth: 0,
      };
    }

    const wallet = wallets[score.author];
    const rewardUsd = bucketRewards[score.bucket as 0 | 1 | 2 | 3] || 0;

    // Get ETH price at merge time
    let ethPrice = currentEthPrice; // Default to current price
    if (score.mergedAt) {
      const mergeDate = score.mergedAt.split("T")[0]; // YYYY-MM-DD

      // Try exact match first
      if (ethPrices[mergeDate] && ethPrices[mergeDate] > 0) {
        ethPrice = ethPrices[mergeDate];
      } else {
        // Find nearest available price in time
        ethPrice = getEthPriceForDate(
          ethPrices,
          mergeDate,
          firstAvailablePrice,
        );
      }
    }

    // Safety check: ensure price is never 0 or negative
    if (!ethPrice || ethPrice <= 0) {
      ethPrice =
        firstAvailablePrice > 0 ? firstAvailablePrice : currentEthPrice;
    }

    // Calculate ETH earned (buying at historical price)
    const ethEarned = rewardUsd / ethPrice;

    // Add to ETH totals
    wallet.totalEth += ethEarned;

    // Add to bucket-specific totals
    if (score.bucket === 0) wallet.bucket0Eth += ethEarned;
    else if (score.bucket === 1) wallet.bucket1Eth += ethEarned;
    else if (score.bucket === 2) wallet.bucket2Eth += ethEarned;
    else if (score.bucket === 3) wallet.bucket3Eth += ethEarned;
  }

  // Calculate current USD value of accumulated ETH for each contributor
  for (const author in wallets) {
    wallets[author].totalUsd = wallets[author].totalEth * currentEthPrice;
  }

  return wallets;
}

/**
 * Pre-calculate wallet balances for ALL PRs at once for performance
 * Returns a map of prNumber -> wallet balances at that point in time
 */
export function preCalculateAllWalletBalances(
  allScores: PrScore[],
  ethPrices: EthPrices,
  prNumbers: number[],
  bucketRewards: BucketRewards = DEFAULT_BUCKET_REWARDS_USD,
): Map<number, Record<string, WalletBalance>> {
  const result = new Map<number, Record<string, WalletBalance>>();

  // Get price lookup helper
  const sortedDates = Object.keys(ethPrices).sort();
  const firstAvailablePrice =
    sortedDates.length > 0 ? ethPrices[sortedDates[0]] : 3000;

  // For each PR number, calculate balances
  for (const prNumber of prNumbers) {
    // Get ETH price at this PR's merge time
    const prScore = allScores.find((s) => s.prNumber === prNumber);
    let ethPriceAtThisPR = firstAvailablePrice;

    if (prScore?.mergedAt) {
      const mergeDate = prScore.mergedAt.split("T")[0];
      ethPriceAtThisPR =
        ethPrices[mergeDate] ||
        getEthPriceForDate(ethPrices, mergeDate, firstAvailablePrice);
    }

    // Calculate balances up to this PR
    const balances = calculateWalletBalances(
      allScores,
      ethPrices,
      prNumber,
      ethPriceAtThisPR,
      bucketRewards,
    );

    result.set(prNumber, balances);
  }

  return result;
}

/**
 * Get ETH price for a specific date, or closest available in time
 */
export function getEthPriceForDate(
  ethPrices: EthPrices,
  date: string,
  fallback: number,
): number {
  const dateKey = date.split("T")[0]; // YYYY-MM-DD

  // Try exact match
  if (ethPrices[dateKey] && ethPrices[dateKey] > 0) {
    return ethPrices[dateKey];
  }

  // Find closest date (prefer earlier dates, then later)
  const dates = Object.keys(ethPrices).sort();

  // Look for the closest earlier date
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dates[i] <= dateKey && ethPrices[dates[i]] > 0) {
      return ethPrices[dates[i]];
    }
  }

  // If no earlier date, find the closest later date
  for (const d of dates) {
    if (d >= dateKey && ethPrices[d] > 0) {
      return ethPrices[d];
    }
  }

  // Last resort: return fallback
  return fallback > 0 ? fallback : 1; // Ensure never 0
}
