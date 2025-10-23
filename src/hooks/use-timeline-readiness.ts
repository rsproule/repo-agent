import { useQuery } from "@tanstack/react-query";

export interface TimelineReadiness {
  isReady: boolean;
  totalMergedPRs: number;
  scoredPRs: number;
  unscoredPRs: number;
  coverage: number;
}

async function fetchTimelineReadiness(
  owner: string,
  repo: string,
): Promise<TimelineReadiness> {
  const response = await fetch(`/api/timeline/readiness/${owner}/${repo}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export function useTimelineReadiness(
  owner: string,
  repo: string,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  },
) {
  return useQuery<TimelineReadiness, Error>({
    queryKey: ["timeline-readiness", owner, repo],
    queryFn: () => fetchTimelineReadiness(owner, repo),
    enabled: options?.enabled !== false && !!owner && !!repo,
    refetchInterval: options?.refetchInterval,
    staleTime: 30 * 1000, // 30 seconds
  });
}
