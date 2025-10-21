import React from "react";
import { cn } from "@/lib/utils";

interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const HStack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-row items-center", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

HStack.displayName = "HStack";

export const VStack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

VStack.displayName = "VStack";