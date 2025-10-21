import React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { HStack, VStack } from "@/components/ui/stack";
import { Suspense } from "@/components/ui/suspense";

import { cn } from "@/lib/utils";
import { useLocalPr } from "@/hooks/use-attribution";
import { AttributionBadge } from "@/components/ui/attribution-badge";

// Use existing types from your project
import type { PRAttribution } from "@/lib/attribution";

interface Repository {
  id: number;
  owner: { login: string };
  name: string;
}

interface Props {
  repo: Repository;
  pr: PRAttribution;
  showModal?: boolean;
}

// Simple avatar component
const MinimalGithubAvatar: React.FC<{ login: string; className?: string }> = ({
  login,
  className,
}) => (
  <img
    src={`https://github.com/${login}.png`}
    alt={login}
    className={cn("rounded-full", className)}
  />
);


export const PrRow: React.FC<Props> = ({ repo, pr, showModal }) => {
  // For now, just render the content directly
  // In the original, this would wrap with PrModal when showModal is true
  return <PrRowContent pr={pr} />;
};

const PrRowContent = React.forwardRef<
  HTMLDivElement,
  {
    pr: PRAttribution;
    isClickable?: boolean;
    onClick?: () => void;
  }
>(({ pr, isClickable, onClick }, ref) => {
  const { data: prData, isLoading: isPrLoading } = useLocalPr(
    pr.prId.toString(),
  );

  return (
    <div
      ref={ref}
      className={cn(
        "grid grid-cols-8 items-center gap-2 w-full text-sm px-1 hover:bg-foreground/5 rounded-md transition-colors duration-200 mb-2",
        isClickable && "cursor-pointer",
      )}
      onClick={onClick}
    >
      <div className={cn("col-span-6 overflow-hidden")}>
        <Suspense
          value={prData}
          isLoading={isPrLoading}
          component={(prData) => (
            <HStack className="gap-2">
              <MinimalGithubAvatar
                login={prData.user.login}
                className="size-6 shrink-0"
              />
              <VStack className="items-start flex-1 overflow-hidden gap-0">
                <span className="text-sm font-semibold overflow-hidden text-ellipsis whitespace-nowrap block w-full">
                  {prData.title}
                </span>
                <HStack className="gap-2 w-full">
                  <span className="text-xs text-muted-foreground truncate no-wrap font-light">
                    #{prData.number} • {prData.user.login}
                  </span>
                  {prData.additions !== undefined &&
                    prData.deletions !== undefined && (
                      <span className={"text-xs font-light"}>
                        <span className="text-green-600">
                          +{prData.additions.toLocaleString()}
                        </span>{" "}
                        <span className="text-red-600">
                          -{prData.deletions.toLocaleString()}
                        </span>
                      </span>
                    )}
                </HStack>
              </VStack>
            </HStack>
          )}
          loadingComponent={<LoadingPrCardBody />}
        />
      </div>
      <HStack className="justify-end col-span-2 text-sm">
        <AttributionBadge attribution={pr} className="px-1 py-0.5 rounded-md" />
      </HStack>
    </div>
  );
});

PrRowContent.displayName = "PrRowContent";

export const LoadingPrRow: React.FC = () => {
  return (
    <div
      className={cn(
        "grid grid-cols-8 items-center gap-2 w-full text-sm px-1 rounded-md transition-colors duration-200 mb-2",
      )}
    >
      <div className="col-span-6 overflow-hidden">
        <LoadingPrCardBody />
      </div>
      <HStack className="justify-end col-span-2 text-sm">
        <Skeleton className={"w-16 h-4"} />
      </HStack>
    </div>
  );
};

const LoadingPrCardBody: React.FC = () => {
  return (
    <HStack className="gap-2">
      <Skeleton className="size-6 shrink-0 rounded-full" />
      <VStack className="gap-2 flex-1 items-start">
        <Skeleton className="w-full h-4" />
        <HStack className="gap-2 w-full">
          <Skeleton className="w-4 h-3" />
          <Skeleton className="w-16 h-3" />
          <Skeleton className="w-6 h-3" />
          <Skeleton className="w-6 h-3" />
        </HStack>
      </VStack>
    </HStack>
  );
};