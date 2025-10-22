import React from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/stack";
import { TimeRangeOptions } from "./time-range-options";
import { cn } from "@/lib/utils";

interface Props {
  selectedTimeRangeOption: TimeRangeOptions;
  setSelectedTimeRangeOption: (timeRangeOption: TimeRangeOptions) => void;
  timeRange: {
    min_time: Date;
    max_time: Date;
  };
  containerClassName?: string;
}

export const TimeRangeButtons: React.FC<Props> = ({
  selectedTimeRangeOption,
  setSelectedTimeRangeOption,
  timeRange,
  containerClassName,
}) => {
  return (
    <HStack className={cn("gap-1", containerClassName)}>
      {Object.values(TimeRangeOptions).map((option) => (
        <Button
          key={option}
          variant={
            selectedTimeRangeOption === option ? "outline" : "ghost"
          }
          onClick={() => setSelectedTimeRangeOption(option)}
          size="xs"
          className={cn(
            "text-xs border",
            selectedTimeRangeOption !== option && "border-transparent",
          )}
        >
          {option === TimeRangeOptions.Custom &&
          selectedTimeRangeOption === option
            ? timeRange.max_time.getTime() === timeRange.min_time.getTime()
              ? "Drag to Select"
              : `${format(timeRange.min_time, "M/d/yy")} - ${format(timeRange.max_time, "M/d/yy")}`
            : option}
        </Button>
      ))}
    </HStack>
  );
};