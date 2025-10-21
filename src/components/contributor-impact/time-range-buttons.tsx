import React from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
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
    <div className={cn("flex gap-1", containerClassName)}>
      {Object.values(TimeRangeOptions).map((option) => (
        <Button
          key={option}
          variant={
            selectedTimeRangeOption === option ? "default" : "outline"
          }
          onClick={() => setSelectedTimeRangeOption(option)}
          size="sm"
          className={cn(
            "text-xs border",
            selectedTimeRangeOption !== option && "border-gray-300 text-gray-600 bg-white hover:bg-gray-50",
            selectedTimeRangeOption === option && "bg-blue-100 text-blue-700 border-blue-300"
          )}
        >
          {option === TimeRangeOptions.Custom &&
          selectedTimeRangeOption === option
            ? timeRange.max_time === timeRange.min_time
              ? "Drag to Select"
              : `${format(timeRange.min_time, "M/d/yy")} - ${format(timeRange.max_time, "M/d/yy")}`
            : option}
        </Button>
      ))}
    </div>
  );
};