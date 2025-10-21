import React from "react";

import { Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/stack";

import { cn } from "@/lib/utils";

interface Props {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isLoading: boolean;
  rightItem?: React.ReactNode;
}

export const SubCard = ({
  title,
  description,
  icon,
  children,
  rightItem,
  isLoading,
}: Props) => {
  return (
    <Card
      className={cn(
        "border rounded-lg border-border/50 flex flex-col",
        "transform-gpu dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff15_inset]",
      )}
    >
      <HStack className="px-4 py-2 border-b border-border/50 justify-between">
        <div className="flex flex-col group">
          <HStack className="justify-between">
            <HStack className="gap-2">
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : icon}
              <h3 className="font-semibold">{title}</h3>
            </HStack>
          </HStack>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {rightItem}
      </HStack>

      <div className="px-3 py-4 h-full group">{children}</div>
    </Card>
  );
};