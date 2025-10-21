export interface PrAggregationResponse {
  buckets: Array<{
    bucket_start: string;
    bucket_end: string;
    pr_count: number;
  }>;
  query_period?: {
    start: string;
    end: string;
  };
}