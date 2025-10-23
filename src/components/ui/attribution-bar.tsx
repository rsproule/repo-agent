import React, { useMemo } from "react";

import { cn } from "@/lib/utils";

interface Props {
  width: number;
  bucketAttributions: [number, number, number, number];
}

export const AttributionBar: React.FC<Props> = ({
  width,
  bucketAttributions,
}) => {
  const total = bucketAttributions.reduce((sum, val) => sum + val, 0);
  const percentages = bucketAttributions.map((val) => (val / total) * 100);

  const getBucketClass = (index: number) => {
    switch (index) {
      case 0:
        return "bg-primary-15";
      case 1:
        return "bg-primary-30";
      case 2:
        return "bg-primary-60";
      case 3:
        return "bg-primary-100";
      default:
        return "";
    }
  };

  return (
    <div
      className="w-full h-3 rounded-full overflow-hidden transition-all duration-300 ease-out"
      style={{ width: `${width}%` }}
    >
      <div className="flex h-full divide-x divide-white/40 dark:divide-black/40">
        {percentages.map(
          (percentage, index) =>
            percentage > 0 && (
              <div
                key={index}
                className={cn(
                  "h-full transition-all duration-300 ease-out",
                  getBucketClass(index),
                )}
                style={{
                  width: `${percentage}%`,
                }}
              />
            ),
        )}
      </div>
    </div>
  );
};

interface LoadingProps {
  width: number;
}

export const LoadingAttributionBar: React.FC<LoadingProps> = ({ width }) => {
  const randomAttributions = useMemo(() => {
    const numbers = Array.from({ length: 4 }, () => Math.random());
    const sum = numbers.reduce((a, b) => a + b, 0);
    return numbers.map((n) => (n / sum) * 100) as [
      number,
      number,
      number,
      number,
    ];
  }, []);

  return (
    <div
      className="w-full h-3 rounded-full overflow-hidden animate-pulse"
      style={{ width: `${width}%` }}
    >
      <div className="flex h-full divide-x divide-white/40 dark:divide-black/40">
        {randomAttributions.map((percentage, index) => (
          <div
            key={index}
            className={cn(
              "h-full",
              index === 0 &&
                "bg-neutral-200 dark:bg-neutral-700/20 rounded-l-full",
              index === 1 && "bg-neutral-200 dark:bg-neutral-700/30",
              index === 2 && "bg-neutral-200 dark:bg-neutral-700/60",
              index === 3 &&
                "bg-neutral-200 dark:bg-neutral-700 rounded-r-full",
            )}
            style={{
              width: `${percentage}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
};
