export interface UserPct {
  user_id: number;
  pct: number;
  bucket_0_count: number;
  bucket_1_count: number;
  bucket_2_count: number;
  bucket_3_count: number;
  bucket_0_agg_pct: number;
  bucket_1_agg_pct: number;
  bucket_2_agg_pct: number;
  bucket_3_agg_pct: number;
}

export interface PRAttribution {
  user_id: number;
  pr_id: number;
  pct: number;
  init_bucket: number;
  pr_score: number;
  merged_at: string;
  pre_override_bucket?: number;
  original_override_bucket?: number;
  override_reason?: string;
}

export interface AttributionPreFilters {
  filter_ids?: string[];
  min_time?: string;
  max_time?: string;
}

export interface AttributionPostFilters {
  user_id?: number;
  min_pct?: number;
  max_pct?: number;
  init_bucket?: number;
}

export interface AttributionOverrides {
  agg_bucket_pct?: number[];
}

export interface Quartile {
  quartile_index: number;
  count: number;
  aggregate_pct: number;
  min_pct: number;
  max_pct: number;
}

export interface ManualOverrideRequest {
  new_bucket: 0 | 1 | 2 | 3;
  reason?: string;
}

export interface ManualOverrideResponse {
  success: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
}