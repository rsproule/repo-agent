import React, {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
} from "react";

import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  format,
  addDays,
  subMonths,
  differenceInDays,
  subYears,
  startOfDay,
  min,
  subDays,
} from "date-fns";

import { Card } from "@/components/ui/card";
import { GitPullRequest, Loader2 } from "lucide-react";
import { useQuartilesByTime, usePrAggregation, type PrAggregationResponse } from "@/hooks/use-attribution";
import { cn } from "@/lib/utils";

interface Repository {
  owner: { login: string };
  name: string;
  created_at?: string;
}


interface ChartDataPoint {
  key: number;
  startDate: Date;
  endDate: Date;
  count: number;
  date: number;
  fill?: string;
}

interface LoadingData<T> {
  data: T | undefined;
  isLoading: boolean;
}

interface Props {
  repo: Repository;
  data: LoadingData<PrAggregationResponse>;
  isSelected: (point: ChartDataPoint) => boolean;
  months: number;
  numBuckets?: number;
  handleMouseDown?: (chartData: ChartDataPoint[]) => any;
  handleMouseMove?: (chartData: ChartDataPoint[]) => any;
  handleMouseUp?: (chartData: ChartDataPoint[]) => any;
  height?: number;
}

const startOfDayISO = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const endOfDayISO = (date: Date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
};

const parseISOToDate = (iso: string) => new Date(iso);

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
  if (data.isLoading || !data.data) {
    return <LoadingChart height={height} />;
  }

  return (
    <TimeRangeFilterChartBody
      repo={repo}
      data={data.data}
      months={months}
      numBuckets={numBuckets}
      isSelected={isSelected}
      handleMouseDown={handleMouseDown}
      handleMouseMove={handleMouseMove}
      handleMouseUp={handleMouseUp}
      height={height}
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
          ? min([startOfDay(new Date(repo.created_at)), subDays(new Date(), 7)])
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
    data.buckets.forEach((dataBucket) => {
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
      return isSelected(entry)
        ? "#3b82f6"  // Blue color for selected
        : "rgb(156 163 175 / 0.3)"; // Gray for unselected
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
                fill: "#6b7280",
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
              axisLine={{ stroke: "rgb(229 231 235 / 0.5)" }}
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
                fill: "#6b7280",
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
  // Get PR count for this specific time bucket
  const { data: prData, isLoading } = usePrAggregation(
    repo.owner.login,
    repo.name,
    {
      start_window: startDate.toISOString(),
      end_window: endDate.toISOString(),
      window: 'day' // Use daily granularity for tooltip
    }
  );

  // Also get quartiles for the same time range for detailed breakdown
  const { data: quartiles, isLoading: quartilesLoading } = useQuartilesByTime(
    repo.owner.login,
    repo.name,
    startDate.toISOString(),
    endDate.toISOString(),
  );

  const countRef = useRef<number>();

  useEffect(() => {
    if (prData) {
      countRef.current = prData.total_prs;
    }
  }, [prData]);

  const count = useMemo(() => {
    return prData?.total_prs ?? countRef.current;
  }, [prData]);

  const getScoreClassName = (bucket: number) => {
    switch (bucket) {
      case 0:
        return "bg-gray-100 text-gray-700";
      case 1:
        return "bg-blue-100 text-blue-700";
      case 2:
        return "bg-green-100 text-green-700";
      case 3:
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <Card className="p-2 rounded-md flex flex-col gap-2 bg-white/90 backdrop-blur-sm border shadow-lg">
      <div className="flex gap-4 items-center">
        <div className="flex gap-1 items-center">
          {isLoading && !countRef.current ? (
            <div className="opacity-40 h-7 flex items-center">
              <div className="w-6 h-5 bg-gray-200 animate-pulse rounded" />
            </div>
          ) : (
            <p className="font-bold text-xl">{(count || 0).toLocaleString()}</p>
          )}
          <GitPullRequest className="size-4" />
        </div>
        <p className="text-xs opacity-60">
          {format(startDate, "M/d/yy")} - {format(endDate, "M/d/yy")}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        {["Exceptional", "High", "Medium", "Low"].map((label, i) => (
          <div
            key={`${label}-${quartiles?.[3 - i]?.count}`}
            className={cn(
              "flex gap-4 rounded-md p-1 items-center w-full justify-between",
              getScoreClassName(3 - i),
            )}
          >
            <p className="text-xs font-medium">{label}</p>
            {quartilesLoading ? (
              <Loader2 className="w-3 h-3 animate-spin text-gray-500" />
            ) : (
              <p className="text-xs">{quartiles?.[3 - i]?.count || 0}</p>
            )}
          </div>
        ))}
      </div>
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
              fill: "#6b7280",
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
            axisLine={{ stroke: "rgb(229 231 235 / 0.5)" }}
            allowDecimals={false}
            ticks={ticks}
          />
          <Bar
            dataKey="count"
            radius={[4, 4, 0, 0]}
            fillOpacity={0.8}
            stroke="none"
            fill="rgb(156 163 175 / 0.2)"
            className="animate-pulse"
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};