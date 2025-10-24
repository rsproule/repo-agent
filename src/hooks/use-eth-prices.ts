import { useQuery } from "@tanstack/react-query";

export interface EthPrices {
  prices: Record<string, number>;
  count: number;
}

async function fetchEthPrices(
  fromTimestamp: number,
  toTimestamp: number,
): Promise<EthPrices> {
  const url = `/api/eth/prices?from=${fromTimestamp}&to=${toTimestamp}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export function useEthPrices(
  fromDate: Date | null,
  toDate: Date | null,
  options?: {
    enabled?: boolean;
  },
) {
  const from = fromDate ? Math.floor(fromDate.getTime() / 1000) : null;
  const to = toDate ? Math.floor(toDate.getTime() / 1000) : null;

  const isEnabled = options?.enabled !== false && !!from && !!to;

  return useQuery<EthPrices, Error>({
    queryKey: ["eth-prices", from, to],
    queryFn: () => {
      if (!from || !to) {
        throw new Error("Date range required");
      }
      return fetchEthPrices(from, to);
    },
    enabled: isEnabled,
    staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // Keep for 7 days
  });
}
