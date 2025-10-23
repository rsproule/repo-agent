import type { PaginatedResponse, UserAttribution } from "@/lib/attribution";
import { useQuery } from "@tanstack/react-query";

export interface PrRange {
  minPrNumber: number;
  maxPrNumber: number;
  prNumbers: number[];
  totalCount: number;
}

async function fetchTimelineAttribution(
  owner: string,
  repo: string,
  maxPrNumber: number,
): Promise<PaginatedResponse<UserAttribution>> {
  const searchParams = new URLSearchParams({
    owner,
    repo,
    maxPrNumber: maxPrNumber.toString(),
  });

  const response = await fetch(`/api/attribution/timeline?${searchParams}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

async function fetchPrRange(owner: string, repo: string): Promise<PrRange> {
  const response = await fetch(`/api/prs/range/${owner}/${repo}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export function useTimelineAttribution(
  owner: string,
  repo: string,
  maxPrNumber: number,
  options?: {
    enabled?: boolean;
  },
) {
  return useQuery<PaginatedResponse<UserAttribution>, Error>({
    queryKey: ["timeline-attribution", owner, repo, maxPrNumber],
    queryFn: () => fetchTimelineAttribution(owner, repo, maxPrNumber),
    enabled: options?.enabled !== false && !!owner && !!repo && maxPrNumber > 0,
    staleTime: Infinity, // Cache indefinitely - timeline data won't change
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function usePrRange(
  owner: string,
  repo: string,
  options?: {
    enabled?: boolean;
  },
) {
  return useQuery<PrRange, Error>({
    queryKey: ["pr-range", owner, repo],
    queryFn: () => fetchPrRange(owner, repo),
    enabled: options?.enabled !== false && !!owner && !!repo,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
