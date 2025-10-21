import React, { useMemo } from "react";
import { GitPullRequest } from "lucide-react";
import { cn } from "@/lib/utils";

interface PrCountBannerProps {
  prData?: {
    buckets: Array<{
      bucket_start: Date;
      bucket_end: Date;
      pr_count: number;
    }>;
  };
  isLoading: boolean;
  timeRange: {
    min_time: Date;
    max_time: Date;
  };
  drag?: {
    isDragging: boolean;
    dragStart: Date | null;
    dragEnd: Date | null;
  };
  countClassName?: string;
  iconClassName?: string;
}

export const PrCountBanner: React.FC<PrCountBannerProps> = ({
  prData,
  isLoading,
  timeRange,
  drag,
  countClassName,
  iconClassName,
}) => {
  const { startDate, endDate } = useMemo(() => {
    if (drag?.isDragging && drag.dragStart && drag.dragEnd) {
      const [earlierDragDate, laterDragDate] = [
        drag.dragStart,
        drag.dragEnd,
      ].sort((a, b) => a.getTime() - b.getTime());
      return {
        startDate: earlierDragDate,
        endDate: laterDragDate,
      };
    }
    return {
      startDate: timeRange.min_time,
      endDate: timeRange.max_time,
    };
  }, [drag?.isDragging, drag?.dragStart, drag?.dragEnd, timeRange]);

  const totalCount = useMemo(() => {
    if (!prData?.buckets) return 0;

    return prData.buckets
      .filter((bucket) => {
        return (
          bucket.bucket_start <= endDate && bucket.bucket_end >= startDate
        );
      })
      .reduce((acc, bucket) => {
        const overlapStart =
          bucket.bucket_start > startDate ? bucket.bucket_start : startDate;
        const overlapEnd =
          bucket.bucket_end < endDate ? bucket.bucket_end : endDate;

        const bucketDuration =
          bucket.bucket_end.getTime() - bucket.bucket_start.getTime();
        const overlapDuration = overlapEnd.getTime() - overlapStart.getTime();

        const overlapRatio =
          bucketDuration > 0 ? overlapDuration / bucketDuration : 1;

        if (overlapRatio >= 0.5) {
          return acc + bucket.pr_count;
        }

        const proportion = overlapRatio;
        return acc + Math.round(bucket.pr_count * proportion);
      }, 0);
  }, [prData, startDate, endDate]);

  return (
    <div className="flex flex-col">
      <h1 className="text-gray-500 text-sm md:text-base">
        Selected PRs
      </h1>
      <div className="flex flex-row items-center gap-2">
        {isLoading ? (
          <div className="h-10 w-16 bg-gray-200 animate-pulse rounded" />
        ) : (
          <>
            <h1 className={cn("text-2xl md:text-4xl font-bold", countClassName)}>
              {(totalCount ?? 0).toLocaleString()}{" "}
            </h1>
            <GitPullRequest className={cn("size-8", iconClassName)} />
          </>
        )}
      </div>
    </div>
  );
};