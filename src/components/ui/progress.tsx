"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    vertical?: boolean;
    indicatorColor?: string;
  }
>(
  (
    {
      className,
      value,
      vertical = false,
      indicatorColor = "bg-secondary",
      ...props
    },
    ref,
  ) => (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        vertical
          ? "relative w-4 h-full overflow-hidden rounded-full bg-muted"
          : "relative h-4 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={`${vertical ? "w-full h-full" : "h-full w-full"} flex-1 transition-all ${indicatorColor}`}
        style={
          vertical
            ? { transform: `translateY(${100 - (value || 0)}%)` }
            : { transform: `translateX(-${100 - (value || 0)}%)` }
        }
      />
    </ProgressPrimitive.Root>
  ),
);
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress }
