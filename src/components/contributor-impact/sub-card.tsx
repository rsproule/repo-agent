import React from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
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
        "border rounded-lg border-gray-200 flex flex-col",
        "transform-gpu dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff15_inset]",
      )}
    >
      <div className="flex px-3 py-2 border-b border-gray-200 justify-between">
        <div className="flex flex-col group">
          <div className="flex justify-between">
            <div className="flex gap-2 items-center">
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : icon}
              <h3 className="font-semibold text-sm">{title}</h3>
            </div>
          </div>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        {rightItem}
      </div>

      <div className="px-3 h-full group">{children}</div>
    </Card>
  );
};