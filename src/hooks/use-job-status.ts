import { useQuery } from '@tanstack/react-query';

export interface JobProgress {
  current: number;
  total: number;
  stage: string;
}

export interface CurrentJob {
  id: string;
  jobType: 'sync-prs' | 'bucket-prs' | 'sync-and-bucket-prs';
  status: 'waiting' | 'queued' | 'executing' | 'completed' | 'failed';
  progress?: JobProgress;
  startedAt: string;
  stage?: string;
}

export interface JobStatusResponse {
  currentJobs: CurrentJob[];
  isRunning: boolean;
  lastSuccessfulSync?: string;
  dataFreshness: 'fresh' | 'stale' | 'unknown';
  latestJobStatus: string | null;
}

const fetcher = async (url: string): Promise<JobStatusResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return data;
};

export function useJobStatus(owner: string, repo: string, options?: {
  refreshInterval?: number;
  enabled?: boolean;
}) {
  const {
    refreshInterval = 2000, // Poll every 2 seconds by default
    enabled = true
  } = options || {};

  const { data, error, isLoading, refetch } = useQuery<JobStatusResponse, Error>({
    queryKey: ['job-status', owner, repo],
    queryFn: () => fetcher(`/api/jobs/status/${owner}/${repo}`),
    enabled: enabled && !!owner && !!repo,
    refetchInterval: refreshInterval,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: 5000,
  });

  const isRunning = data?.isRunning || false;
  const currentJobs = data?.currentJobs || [];
  const dataFreshness = data?.dataFreshness || 'unknown';

  // Get the current sync or bucket job
  const syncJob = currentJobs.find(job => job.jobType === 'sync-prs');
  const bucketJob = currentJobs.find(job => job.jobType === 'bucket-prs');
  const anyRunningJob = currentJobs[0]; // Most recent running job

  return {
    data,
    error,
    isLoading,
    isRunning,
    currentJobs,
    syncJob,
    bucketJob,
    anyRunningJob,
    dataFreshness,
    lastSuccessfulSync: data?.lastSuccessfulSync,
    latestJobStatus: data?.latestJobStatus,
    refreshStatus: refetch,
  };
}

export default useJobStatus;