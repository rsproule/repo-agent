import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type {
  UserAttribution,
  PRAttribution,
  Quartile,
  PaginatedResponse,
  AttributionPreFilters,
  AttributionPostFilters,
  AttributionOverrides,
} from '@/lib/attribution';

interface InfiniteQueryResult<T> {
  pages: PaginatedResponse<T>[];
  pageParams: any[];
}

const API_BASE = '/api/attribution';

async function fetchWithQuery(url: string, params: Record<string, any> = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, v.toString()));
      } else {
        searchParams.set(key, value.toString());
      }
    }
  });

  const queryString = searchParams.toString();
  const fullUrl = queryString ? `${url}?${queryString}` : url;

  const response = await fetch(fullUrl);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export function useAttributionByPr(
  owner: string,
  repo: string,
  preFilters?: AttributionPreFilters,
  postFilters?: AttributionPostFilters,
  overrides?: AttributionOverrides,
  options?: {
    enabled?: boolean;
    initialPageParam?: { page: number; page_size: number };
  }
) {
  return useInfiniteQuery<PaginatedResponse<PRAttribution>, Error, InfiniteQueryResult<PRAttribution>>({
    queryKey: ['attribution', 'by-pr', owner, repo, preFilters, postFilters, overrides],
    queryFn: async ({ pageParam = options?.initialPageParam || { page: 1, page_size: 20 } }) => {
      return fetchWithQuery(`${API_BASE}/by-pr`, {
        owner,
        repo,
        page: pageParam.page,
        pageSize: pageParam.page_size,
        initBucket: postFilters?.initBucket,
        userId: postFilters?.userId?.toString(),
        ...preFilters,
        ...overrides,
      });
    },
    enabled: options?.enabled !== false && !!owner && !!repo,
    getNextPageParam: (lastPage) => {
      if (lastPage.hasNext) {
        return { page: lastPage.page + 1, page_size: lastPage.pageSize };
      }
      return undefined;
    },
    initialPageParam: options?.initialPageParam || { page: 1, page_size: 20 },
  });
}

export function useAggregateCaptable(
  owner: string,
  repo: string,
  preFilters?: AttributionPreFilters,
  postFilters?: AttributionPostFilters,
  overrides?: AttributionOverrides,
  options?: {
    enabled?: boolean;
    initialPageParam?: { page: number; page_size: number };
    refreshInterval?: number;
  }
) {
  return useInfiniteQuery<PaginatedResponse<UserAttribution>, Error, InfiniteQueryResult<UserAttribution>>({
    queryKey: ['attribution', 'by-user', owner, repo, preFilters, postFilters, overrides],
    queryFn: async ({ pageParam = options?.initialPageParam || { page: 1, page_size: 30 } }) => {
      return fetchWithQuery(`${API_BASE}/by-user`, {
        owner,
        repo,
        page: pageParam.page,
        pageSize: pageParam.page_size,
        initBucket: postFilters?.initBucket,
        userId: postFilters?.userId?.toString(),
        ...preFilters,
        ...overrides,
      });
    },
    enabled: options?.enabled !== false && !!owner && !!repo,
    getNextPageParam: (lastPage) => {
      if (lastPage.hasNext) {
        return { page: lastPage.page + 1, page_size: lastPage.pageSize };
      }
      return undefined;
    },
    initialPageParam: options?.initialPageParam || { page: 1, page_size: 30 },
    refetchInterval: options?.refreshInterval,
  });
}

export function useAttributionQuartiles(
  owner: string,
  repo: string,
  preFilters?: AttributionPreFilters,
  postFilters?: AttributionPostFilters,
  overrides?: AttributionOverrides,
  options?: { enabled?: boolean; refreshInterval?: number }
) {
  return useQuery<Quartile[], Error>({
    queryKey: ['attribution', 'quartiles', owner, repo, preFilters, postFilters, overrides],
    queryFn: async () => {
      const params = new URLSearchParams({
        owner,
        repo,
      });

      if (preFilters?.minTime) params.append("minTime", preFilters.minTime);
      if (preFilters?.maxTime) params.append("maxTime", preFilters.maxTime);

      const response = await fetch(`/api/attribution/quartiles?${params}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch attribution quartiles");
      }

      return response.json();
    },
    enabled: options?.enabled !== false && !!owner && !!repo,
    refetchInterval: options?.refreshInterval,
  });
}

export function useQuartilesByTime(
  owner: string,
  repo: string,
  minTime?: string,
  maxTime?: string,
  options?: { enabled?: boolean }
) {
  return useQuery<Quartile[], Error>({
    queryKey: ['attribution', 'quartiles-by-time', owner, repo, minTime, maxTime],
    queryFn: async () => {
      const params = new URLSearchParams({
        owner,
        repo,
      });

      if (minTime) params.append("minTime", minTime);
      if (maxTime) params.append("maxTime", maxTime);

      const response = await fetch(`/api/attribution/quartiles?${params}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch attribution quartiles");
      }

      return response.json();
    },
    enabled: options?.enabled !== false && !!owner && !!repo,
  });
}

export function useQuartileDetails(
  owner: string,
  repo: string,
  quartileIndex: number,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['attribution', 'quartiles', quartileIndex, owner, repo],
    queryFn: async () => {
      return fetchWithQuery(`${API_BASE}/quartiles/${quartileIndex}`, {
        owner,
        repo,
      });
    },
    enabled: options?.enabled !== false && !!owner && !!repo && quartileIndex >= 0 && quartileIndex <= 3,
  });
}

export interface PrTimeBucket {
  bucket_start: Date;
  bucket_end: Date;
  pr_count: number;
}

export interface QueryPeriod {
  start: Date;
  end: Date;
  window: 'day' | 'week' | 'month';
}

export interface PrAggregationResponse {
  buckets: PrTimeBucket[];
  total_prs: number;
  query_period: QueryPeriod;
}

export interface PrAggregationParams {
  start_window?: string;
  end_window?: string;
  window?: 'day' | 'week' | 'month';
}

export function usePrAggregation(
  owner: string,
  repo: string,
  params: PrAggregationParams,
  options?: { enabled?: boolean; refreshInterval?: number }
) {
  return useQuery<PrAggregationResponse, Error>({
    queryKey: ['prs', 'aggregation', owner, repo, params],
    queryFn: async () => {
      const response = await fetchWithQuery('/api/prs/aggregation', {
        owner,
        repo,
        ...params,
      });

      // Transform dates to ensure proper typing
      return {
        ...response,
        query_period: {
          ...response.query_period,
          start: new Date(response.query_period.start),
          end: new Date(response.query_period.end),
        },
        buckets: response.buckets.map((bucket: any) => ({
          bucket_start: new Date(bucket.bucket_start),
          bucket_end: new Date(bucket.bucket_end),
          pr_count: bucket.pr_count,
        })),
      } as PrAggregationResponse;
    },
    enabled: options?.enabled !== false && !!owner && !!repo,
    refetchInterval: options?.refreshInterval,
  });
}

interface RepositoryMetadata {
  owner: { login: string };
  name: string;
  created_at: string;
}

export function useRepositoryMetadata(
  owner: string,
  repo: string,
  options?: { enabled?: boolean }
) {
  return useQuery<RepositoryMetadata, Error>({
    queryKey: ['repos', 'metadata', owner, repo],
    queryFn: async () => {
      return fetchWithQuery('/api/repos/metadata', {
        owner,
        repo,
      });
    },
    enabled: options?.enabled !== false && !!owner && !!repo,
  });
}

// User search types and hook
interface UserRepoSearchResult {
  id: string;
  login: string;
  avatar_url: string;
  total_prs: number;
  merged_prs: number;
}

interface RepoSearchParams {
  search?: string;
  start_window?: string;
  end_window?: string;
}

export function useRepoSearch(
  owner: string,
  repo: string,
  params: RepoSearchParams = {},
  options?: { enabled?: boolean }
) {
  return useInfiniteQuery<PaginatedResponse<UserRepoSearchResult>, Error, InfiniteQueryResult<UserRepoSearchResult>>({
    queryKey: ['repos', 'users', owner, repo, params],
    queryFn: async ({ pageParam = { page: 1, page_size: 20 } }) => {
      return fetchWithQuery('/api/repos/users', {
        owner,
        repo,
        page: pageParam.page,
        pageSize: pageParam.page_size,
        ...params,
      });
    },
    enabled: options?.enabled !== false && !!owner && !!repo,
    getNextPageParam: (lastPage) => {
      if (lastPage.hasNext) {
        return { page: lastPage.page + 1, page_size: lastPage.pageSize };
      }
      return undefined;
    },
    initialPageParam: { page: 1, page_size: 20 },
  });
}

// PR details hook
interface PullRequest {
  id: number;
  number: number;
  title: string;
  user: {
    login: string;
    avatar_url: string;
  };
  additions?: number;
  deletions?: number;
  state: string;
  html_url: string;
  body?: string;
  created_at: string;
  updated_at: string;
  merged_at?: string;
}

export function useLocalPr(prId: string, options?: { enabled?: boolean }) {
  return useQuery<PullRequest, Error>({
    queryKey: ['prs', 'details', prId],
    queryFn: async () => {
      const response = await fetch(`/api/prs/${prId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    enabled: options?.enabled !== false && !!prId,
  });
}