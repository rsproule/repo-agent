import React, { useCallback, useRef, useState } from "react";

import { subMonths, subDays } from "date-fns";

import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/stack";

import { TimeRangeFilterChart } from "./chart";
import { PrCountBanner } from "./pr-count-banner";
import { WindowViewSelect } from "./window-view-select";
import { TimeRangeButtons } from "./time-range-buttons";
import { TimeRangeOptions } from "./time-range-options";

import { usePrAggregation } from "@/hooks/use-attribution";

import { cn } from "@/lib/utils";
import { endOfDayISO, parseISOToDate, startOfDayISO } from "@/lib/date-utils";

import type { Repository } from "@/types/repository";
import type { ChartDataPoint } from "./types";
import type { CategoricalChartFunc } from "recharts/types/chart/generateCategoricalChart";

interface Props {
  repo: Repository;
  minTime: Date;
  maxTime: Date;
  setMinTime: (minTime: Date) => void;
  setMaxTime: (maxTime: Date) => void;
}

export const PrGraph: React.FC<Props> = ({
  repo,
  minTime,
  maxTime,
  setMinTime,
  setMaxTime,
}) => {
  const [startWindow] = useState(
    repo.created_at
      ? startOfDayISO(new Date(repo.created_at))
      : startOfDayISO(new Date()),
  );
  const [endWindow] = useState(endOfDayISO(maxTime));
  const [months, setMonths] = useState(0);

  const [selectedTimeRangeOption, setSelectedTimeRangeOption] = useState(
    TimeRangeOptions.All,
  );

  const [dragRangeStart, setDragRangeStart] = useState<Date | null>(null);
  const [dragRangeEnd, setDragRangeEnd] = useState<Date | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { data: prData, isLoading } = usePrAggregation(
    repo.owner.login,
    repo.name,
    {
      start_window: startWindow,
      end_window: endWindow,
      window: 'day',
    },
  );

  // Find the bucket for a given x-axis date string
  const findBucketByDate = useCallback(
    (chartData: ChartDataPoint[]) => (key: number) => {
      return chartData.find((bucket) => bucket.key === key);
    },
    [],
  );

  // Store anchor bucket on mouse down
  const dragAnchor = useRef<{ startDate: Date; endDate: Date } | null>(null);

  const handleMouseDown: (chartData: ChartDataPoint[]) => CategoricalChartFunc =
    useCallback(
      (chartData: ChartDataPoint[]) => (e) => {
        if (!e || !e.activePayload) return;
        const key = e.activePayload[0].payload.key;
        const bucket = findBucketByDate(chartData)(key);
        if (!bucket) return;
        dragAnchor.current = {
          startDate: bucket.startDate,
          endDate: bucket.endDate,
        };
        setDragRangeStart(bucket.startDate);
        setDragRangeEnd(bucket.endDate);
        setIsDragging(true);
      },
      [findBucketByDate, setDragRangeStart, setDragRangeEnd, setIsDragging],
    );

  const handleMouseMove: (chartData: ChartDataPoint[]) => CategoricalChartFunc =
    useCallback(
      (chartData: ChartDataPoint[]) => (e) => {
        if (!isDragging || !e || !e.activePayload) return;
        const key = e.activePayload[0].payload.key;
        const bucket = findBucketByDate(chartData)(key);
        if (!bucket || !dragAnchor.current) return;
        // Always select the full range between anchor and current bucket
        const minStart =
          dragAnchor.current.startDate < bucket.startDate
            ? dragAnchor.current.startDate
            : bucket.startDate;
        const maxEnd =
          dragAnchor.current.endDate > bucket.endDate
            ? dragAnchor.current.endDate
            : bucket.endDate;
        setDragRangeStart(minStart);
        setDragRangeEnd(maxEnd);
      },
      [isDragging, findBucketByDate, setDragRangeStart, setDragRangeEnd],
    );

  const handleMouseUp: (chartData: ChartDataPoint[]) => CategoricalChartFunc =
    useCallback(
      () => () => {
        dragAnchor.current = null;
        if (!isDragging || !dragRangeStart || !dragRangeEnd) return;

        // Use the drag range directly - it already represents the exact bucket boundaries we want
        const [earlier, later] =
          dragRangeStart < dragRangeEnd
            ? [dragRangeStart, dragRangeEnd]
            : [dragRangeEnd, dragRangeStart];

        setMinTime(earlier);
        setMaxTime(later);
        setSelectedTimeRangeOption(TimeRangeOptions.Custom);

        setIsDragging(false);
        setDragRangeStart(null);
        setDragRangeEnd(null);
      },
      [
        isDragging,
        dragRangeStart,
        dragRangeEnd,
        setMinTime,
        setMaxTime,
        setIsDragging,
        setDragRangeStart,
        setDragRangeEnd,
      ],
    );

  // Helper to get sorted drag range
  const getSortedDragRange = useCallback(() => {
    if (!dragRangeStart || !dragRangeEnd) return [null, null];
    const [start, end] =
      dragRangeStart < dragRangeEnd
        ? [dragRangeStart, dragRangeEnd]
        : [dragRangeEnd, dragRangeStart];
    // Convert to ISO strings to ensure consistency with server expectations
    const startISO = startOfDayISO(start);
    const endISO = endOfDayISO(end);
    return [parseISOToDate(startISO), parseISOToDate(endISO)];
  }, [dragRangeStart, dragRangeEnd]);

  const isSelected = useCallback(
    (point: ChartDataPoint) => {
      if (!dragRangeStart || !dragRangeEnd) {
        return (
          minTime.getTime() !== maxTime.getTime() &&
          ((point.startDate >= minTime && point.endDate <= maxTime) ||
            (minTime >= point.startDate && minTime <= point.endDate) ||
            (maxTime >= point.startDate && maxTime <= point.endDate))
        );
      }

      const [start, end] = getSortedDragRange();
      if (!start || !end) return false;
      // Check if bucket overlaps with drag range
      const bucketStart = point.startDate;
      const bucketEnd = point.endDate;
      return bucketStart <= end && bucketEnd >= start;
    },
    [minTime, maxTime, getSortedDragRange, dragRangeStart, dragRangeEnd],
  );

  const handleSelectedTimeRangeOptionChange = (
    timeRangeOption: TimeRangeOptions,
  ) => {
    const now = new Date();
    switch (timeRangeOption) {
      case TimeRangeOptions.OneMonth:
        setMinTime(subMonths(now, 1));
        setMaxTime(now);
        break;
      case TimeRangeOptions.ThreeMonths:
        setMinTime(subMonths(now, 3));
        setMaxTime(now);
        break;
      case TimeRangeOptions.SixMonths:
        setMinTime(subMonths(now, 6));
        setMaxTime(now);
        break;
      case TimeRangeOptions.All:
        setMinTime(
          repo.created_at ? subDays(new Date(repo.created_at), 10) : now,
        );
        setMaxTime(now);
        break;
      case TimeRangeOptions.Custom:
        if (selectedTimeRangeOption !== TimeRangeOptions.Custom) {
          setMinTime(now);
          setMaxTime(now);
        }
        break;
    }
    setSelectedTimeRangeOption(timeRangeOption);
  };

  return (
    <Card
      className={cn(
        "p-4 flex flex-col gap-2 md:gap-4",
        "transform-gpu dark:[box-shadow:0_-20px_80px_-20px_#ffffff15_inset]",
      )}
    >
      <div className="flex flex-col md:flex-row justify-between items-start gap-2">
        <PrCountBanner
          prAggregation={{
            data: prData,
            isLoading,
          }}
          timeRange={{
            min_time: minTime,
            max_time: maxTime,
          }}
          drag={{
            isDragging,
            dragStart: dragRangeStart,
            dragEnd: dragRangeEnd,
          }}
          countClassName="md:text-3xl"
          iconClassName="size-6"
        />
        <TimeRangeButtons
          selectedTimeRangeOption={selectedTimeRangeOption}
          setSelectedTimeRangeOption={handleSelectedTimeRangeOptionChange}
          timeRange={{
            min_time: minTime,
            max_time: maxTime,
          }}
          containerClassName="-ml-1 md:ml-0"
        />
      </div>
      <TimeRangeFilterChart
        repo={repo}
        data={{
          data: prData,
          isLoading,
        }}
        isSelected={isSelected}
        months={months}
        handleMouseDown={handleMouseDown}
        handleMouseMove={handleMouseMove}
        handleMouseUp={handleMouseUp}
      />
      <HStack className="justify-between">
        <p className="text-xs text-muted-foreground/60 italic">
          Drag to select a custom time range
        </p>
        <WindowViewSelect months={months} setMonths={setMonths} />
      </HStack>
    </Card>
  );
};