import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  addDays,
  differenceInDays,
  format,
  min,
  startOfDay,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { Card } from "@/components/ui/card";
import { Suspense } from "@/components/ui/suspense";

import { endOfDayISO, parseISOToDate, startOfDayISO } from "@/lib/date-utils";

import { getScoreClassName } from "@/components/ui/attribution-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HStack, VStack } from "@/components/ui/stack";
import { useAttributionQuartiles } from "@/hooks/use-attribution";
import { cn } from "@/lib/utils";
import type { PrAggregationResponse } from "@/types/api";
import type { LoadingData } from "@/types/loading-data";
import type { Repository } from "@/types/repository";
import { GitPullRequest, Loader2 } from "lucide-react";
import type { CategoricalChartFunc } from "recharts/types/chart/generateCategoricalChart";
import type { ChartDataPoint } from "./types";

interface Props {
  repo: Repository;
  data: LoadingData<PrAggregationResponse>;
  isSelected: (point: ChartDataPoint) => boolean;
  months: number;
  numBuckets?: number;
  handleMouseDown?: (chartData: ChartDataPoint[]) => CategoricalChartFunc;
  handleMouseMove?: (chartData: ChartDataPoint[]) => CategoricalChartFunc;
  handleMouseUp?: (chartData: ChartDataPoint[]) => CategoricalChartFunc;
  height?: number;
}

export const TimeRangeFilterChart: React.FC<Props> = ({
  repo,
  data,
  months,
  numBuckets,
  isSelected,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  height,
}) => {
  return (
    <Suspense
      value={data.data}
      isLoading={data.isLoading}
      component={(data) => (
        <TimeRangeFilterChartBody
          repo={repo}
          data={data}
          months={months}
          numBuckets={numBuckets}
          isSelected={isSelected}
          handleMouseDown={handleMouseDown}
          handleMouseMove={handleMouseMove}
          handleMouseUp={handleMouseUp}
          height={height}
        />
      )}
      loadingComponent={<LoadingChart height={height} />}
    />
  );
};

interface ChartProps extends Omit<Props, "data"> {
  data: PrAggregationResponse;
}

const TimeRangeFilterChartBody: React.FC<ChartProps> = ({
  repo,
  data,
  months,
  numBuckets: numBucketsProp = 36,
  isSelected,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  height = 200,
}) => {
  const [endWindow] = useState<Date>(new Date());
  const [startWindow, setStartWindow] = useState<Date>(subYears(endWindow, 1));

  const numBuckets = useMemo(() => {
    return Math.min(numBucketsProp, differenceInDays(endWindow, startWindow));
  }, [endWindow, startWindow, numBucketsProp]);

  useEffect(() => {
    if (months === 0) {
      setStartWindow(
        repo.created_at
          ? // Take the earlier of the repo creation date or 7 days ago
            min([startOfDay(new Date(repo.created_at)), subDays(new Date(), 7)])
          : startOfDay(new Date()),
      );
    } else {
      setStartWindow(subMonths(endWindow, months));
    }
  }, [months, endWindow, repo.created_at]);

  // Transform pre-aggregated bucket data into chart format with consistent bucket sizes
  const chartData = useMemo(() => {
    const startDayISO = startOfDayISO(startWindow);
    const endDayISO = endOfDayISO(endWindow);
    const startDay = parseISOToDate(startDayISO);
    const endDay = parseISOToDate(endDayISO);

    const totalDays = Math.ceil(
      (endDay.getTime() - startDay.getTime()) / (24 * 60 * 60 * 1000),
    );

    // Calculate bucket size, ensuring minimum of 1 day and identical widths
    const bucketSizeInDays = Math.max(1, Math.ceil(totalDays / numBuckets));
    const actualNumBuckets = Math.ceil(totalDays / bucketSizeInDays);

    const buckets = new Map<
      number,
      { count: number; startDate: Date; endDate: Date; key: number }
    >();

    // Create day-aligned buckets with identical widths
    for (let i = 0; i < actualNumBuckets; i++) {
      const bucketStartDate = addDays(startDay, i * bucketSizeInDays);
      const bucketEndDate = addDays(bucketStartDate, bucketSizeInDays - 1);

      const actualStartDateISO = startOfDayISO(bucketStartDate);
      const actualEndDateISO = endOfDayISO(bucketEndDate);
      const actualStartDate = parseISOToDate(actualStartDateISO);
      const actualEndDate = parseISOToDate(actualEndDateISO);

      // Use start date as key to ensure uniqueness
      const bucketKey = actualStartDate.getTime();

      buckets.set(bucketKey, {
        count: 0,
        startDate: actualStartDate,
        endDate: actualEndDate,
        key: bucketKey,
      });
    }

    // Convert buckets to array for easier access
    const bucketArray = Array.from(buckets.entries()).sort(
      (a, b) => a[0] - b[0],
    );

    // Distribute PR counts from data.buckets into our day-aligned buckets
    data.buckets?.forEach((dataBucket: any) => {
      const dataStartISO = startOfDayISO(new Date(dataBucket.bucket_start));
      const dataEndISO = endOfDayISO(new Date(dataBucket.bucket_end));
      const dataStart = parseISOToDate(dataStartISO);
      const dataEnd = parseISOToDate(dataEndISO);

      // Find all buckets that overlap with this data bucket
      const overlappingBuckets = bucketArray.filter(([, bucket]) => {
        return dataStart <= bucket.endDate && dataEnd >= bucket.startDate;
      });

      if (overlappingBuckets.length > 0) {
        // Distribute PR count proportionally across overlapping buckets based on day overlap
        const totalOverlapDays = overlappingBuckets.reduce(
          (sum, [, bucket]) => {
            const overlapStart =
              dataStart > bucket.startDate ? dataStart : bucket.startDate;
            const overlapEnd =
              dataEnd < bucket.endDate ? dataEnd : bucket.endDate;
            const overlapDays = Math.ceil(
              (overlapEnd.getTime() - overlapStart.getTime()) /
                (24 * 60 * 60 * 1000),
            );
            return sum + Math.max(1, overlapDays);
          },
          0,
        );

        overlappingBuckets.forEach(([, bucket]) => {
          const overlapStart =
            dataStart > bucket.startDate ? dataStart : bucket.startDate;
          const overlapEnd =
            dataEnd < bucket.endDate ? dataEnd : bucket.endDate;
          const overlapDays = Math.ceil(
            (overlapEnd.getTime() - overlapStart.getTime()) /
              (24 * 60 * 60 * 1000),
          );
          const proportion = Math.max(1, overlapDays) / totalOverlapDays;
          bucket.count += Math.round(dataBucket.pr_count * proportion);
        });
      }
    });

    // Convert to array and sort by start date ascending, but use end date for chart x-axis
    return Array.from(buckets.values())
      .sort((a, b) => a.key - b.key)
      .map((bucket) => ({
        ...bucket,
        date: bucket.endDate.getTime(), // Use end date for X-axis positioning
      }));
  }, [data.buckets, numBuckets, startWindow, endWindow]);

  const getBarColor = useCallback(
    (entry: ChartDataPoint) => {
      return isSelected(entry) ? "var(--primary)" : "var(--primary-15)";
    },
    [isSelected],
  );

  // Pre-compute colors for each data point
  const coloredData = useMemo(() => {
    return chartData.map((item) => ({
      ...item,
      fill: getBarColor(item),
    }));
  }, [chartData, getBarColor]);

  // Calculate centered ticks for XAxis
  const numTicks = 6;
  const tickIndices = useMemo(
    () =>
      Array.from({ length: numTicks }, (_, i) =>
        Math.round(((i + 1) * (coloredData.length - 1)) / (numTicks + 1)),
      ),
    [coloredData.length],
  );
  const ticks = useMemo(
    () => tickIndices.map((idx) => coloredData[idx]?.date).filter(Boolean),
    [tickIndices, coloredData],
  );

  const { onMouseDown, onMouseMove, onMouseUp, onMouseLeave } = useMemo(() => {
    return {
      onMouseDown: handleMouseDown?.(coloredData),
      onMouseMove: handleMouseMove?.(coloredData),
      onMouseUp: handleMouseUp?.(coloredData),
      onMouseLeave: handleMouseUp?.(coloredData),
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, coloredData]);

  return (
    <div>
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={coloredData}
            margin={{ top: 0, right: 0, bottom: -10, left: 0 }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
          >
            <XAxis
              dataKey="date"
              tickFormatter={(date: string) => format(new Date(date), "MMM d")}
              tick={{
                fontSize: 12,
                fill: "var(--muted-foreground)",
                style: {
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  MozUserSelect: "none",
                  msUserSelect: "none",
                },
              }}
              ticks={ticks}
              allowDataOverflow={false}
              tickLine={false}
              axisLine={{ stroke: "var(--border) / 0.5)" }}
              allowDecimals={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const { startDate, endDate } = payload[0].payload;
                  return (
                    <TooltipContent
                      repo={repo}
                      startDate={startDate}
                      endDate={endDate}
                    />
                  );
                }
                return null;
              }}
              cursor={{
                fill: "var(--muted-foreground)",
                opacity: 0.1,
              }}
            />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              fillOpacity={0.8}
              stroke="none"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

interface TooltipContentProps {
  startDate: Date;
  endDate: Date;
  repo: Repository;
}

const TooltipContent: React.FC<TooltipContentProps> = ({
  startDate,
  endDate,
  repo,
}) => {
  const { data: quartiles, isLoading } = useAttributionQuartiles(
    repo.owner.login,
    repo.name,
    {
      min_time: startDate.toISOString(),
      max_time: endDate.toISOString(),
    },
  );

  const countRef = useRef<number>();

  useEffect(() => {
    if (quartiles) {
      countRef.current = quartiles.reduce(
        (acc, quartile) => acc + quartile.count,
        0,
      );
    }
  }, [quartiles]);

  const count = useMemo(() => {
    return (
      quartiles?.reduce((acc, quartile) => acc + quartile.count, 0) ??
      countRef.current
    );
  }, [quartiles]);

  return (
    <Card className="p-2 rounded-md flex flex-col gap-2 bg-card/80 backdrop-blur-sm">
      <HStack className="gap-4">
        <HStack className="gap-1">
          <Suspense
            value={count}
            isLoading={isLoading && !countRef.current}
            component={(count) => (
              <p className="font-bold text-xl">{count.toLocaleString()}</p>
            )}
            loadingComponent={
              <HStack className="opacity-40 h-7">
                <Skeleton className="w-6 h-5" />
              </HStack>
            }
          />
          <GitPullRequest className="size-4" />
        </HStack>
        <p className="text-xs opacity-60">
          {format(startDate, "M/d/yy")} - {format(endDate, "M/d/yy")}
        </p>
      </HStack>
      <VStack className="gap-1">
        {["Exceptional", "High", "Medium", "Low"].map((label, i) => (
          <div
            key={`${label}-${quartiles?.[3 - i]?.count}`}
            className={cn(
              "flex gap-4 rounded-md p-1 items-center w-full justify-between",
              getScoreClassName(3 - i),
            )}
          >
            <p className="text-xs font-medium">{label}</p>
            <Suspense
              value={quartiles?.[3 - i]}
              isLoading={isLoading}
              component={(quartile) => (
                <p className="text-xs">{quartile?.count}</p>
              )}
              loadingComponent={
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              }
            />
          </div>
        ))}
      </VStack>
    </Card>
  );
};

const LoadingChart: React.FC<{
  numPoints?: number;
  height?: number;
}> = ({ numPoints = 36, height = 200 }) => {
  const chartData = useMemo(() => {
    return Array.from({ length: numPoints }, (_, i) => ({
      date: format(
        addDays(parseISOToDate(startOfDayISO(new Date())), i),
        "yyyy-MM-dd",
      ),
      count: Math.floor(Math.random() * 100),
    }));
  }, [numPoints]);

  // Calculate centered ticks for XAxis
  const numTicks = 6;
  const tickIndices = useMemo(
    () =>
      Array.from({ length: numTicks }, (_, i) =>
        Math.round(((i + 1) * (chartData.length - 1)) / (numTicks + 1)),
      ),
    [chartData.length],
  );
  const ticks = useMemo(
    () => tickIndices.map((idx) => chartData[idx]?.date).filter(Boolean),
    [tickIndices, chartData],
  );

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <XAxis
            dataKey="date"
            tickFormatter={(date: string) => format(new Date(date), "MMM d")}
            tick={{
              fontSize: 12,
              fill: "var(--muted-foreground)",
              style: {
                userSelect: "none",
                WebkitUserSelect: "none",
                MozUserSelect: "none",
                msUserSelect: "none",
                opacity: 0,
              },
            }}
            allowDataOverflow={false}
            tickLine={false}
            axisLine={{ stroke: "var(--border) / 0.5)" }}
            allowDecimals={false}
            ticks={ticks}
          />
          <Bar
            dataKey="count"
            radius={[4, 4, 0, 0]}
            fillOpacity={0.8}
            stroke="none"
            fill="var(--muted-foreground) / 0.2)"
            className="animate-pulse"
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
