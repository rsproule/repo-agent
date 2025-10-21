import React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { cn } from "@/lib/utils";
import type { PRAttribution } from "@/lib/attribution";

// Score utility functions from merit-repos
export const getScore = (bucket: number) => {
  switch (bucket) {
    case 0:
      return "Low";
    case 1:
      return "Medium";
    case 2:
      return "High";
    case 3:
      return "Exceptional";
  }
};

export const getScoreClassName = (bucket: number) => {
  switch (bucket) {
    case 0:
      return "bg-primary/20 dark:bg-primary/10 font-medium";
    case 1:
      return "bg-primary/50 dark:bg-primary/25";
    case 2:
      return "text-white font-semibold bg-primary/75 dark:bg-primary/50";
    case 3:
      return "bg-primary dark:bg-primary/80 text-white font-bold";
  }
};

export const getScoreDotClassName = (bucket: number) => {
  switch (bucket) {
    case 0:
      return "bg-primary/40";
    case 1:
      return "bg-primary/60";
    case 2:
      return "bg-primary/80";
    case 3:
      return "bg-primary/100 shadow-[0_0_4px] shadow-primary";
  }
};

interface AttributionBadgeProps {
  attribution: PRAttribution;
  className?: string;
  showTooltip?: boolean;
}

export const AttributionBadge: React.FC<AttributionBadgeProps> = ({
  attribution,
  className,
  showTooltip = true,
}) => {
  // Use initBucket as the bucket
  const bucket = attribution.initBucket;

  // Check for overrides (in your case, you might not have these fields)
  const hasOverride = false; // Your PRAttribution type might not have override fields

  const badgeContent = (
    <span
      className={cn(
        "px-1.5 py-0.5 rounded text-xs flex items-center gap-1",
        getScoreClassName(bucket),
        className,
      )}
    >
      {getScore(bucket)}
    </span>
  );

  if (!showTooltip) {
    return badgeContent;
  }

  // Only show tooltip if there's an override, just like merit-repos
  if (!hasOverride) {
    return badgeContent;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
        <TooltipContent side="left" sideOffset={8}>
          <p>Original ranking: {getScore(bucket)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};