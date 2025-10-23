import React, { useEffect, useState } from "react";

import { ChevronDown, ChevronUp, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Suspense } from "@/components/ui/suspense";
import { VStack } from "@/components/ui/stack";

import { PrRow, LoadingPrRow } from "@/components/prs/row";

import { Progress } from "@/components/ui/progress";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

// Use existing types from your project
import type { PRAttribution } from "@/lib/attribution";

interface Repository {
  id: number;
  owner: { login: string };
  name: string;
}

interface UserRepoSearchResult {
  id: number;
  login: string;
  avatar_url: string;
  total_prs: number;
  merged_prs: number;
}

interface LoadingData<T> {
  data: T | null;
  isLoading: boolean;
}

interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

interface InfiniteData<T> {
  pages: T[];
  pageParams: unknown[];
}

interface Props {
  repo: Repository;
  prs: LoadingData<InfiniteData<PaginatedResponse<PRAttribution>>>;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
  minTime: string;
  maxTime: string;
  filterUser: UserRepoSearchResult | undefined;
  filterBucket: number | undefined;
}

const NUM_PRS_TO_SHOW = 4;

const rowHeight = 36;
const gapHeight = 8;
const pageHeight = (rowHeight + gapHeight) * NUM_PRS_TO_SHOW;

export const PrList: React.FC<Props> = ({
  repo,
  prs,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
  minTime,
  maxTime,
  filterUser,
  filterBucket,
}) => {
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    setCurrentPage(0);
  }, [minTime, maxTime, filterUser, filterBucket]);

  return (
    <div className="flex flex-col h-full">
      <Suspense
        value={prs.data}
        isLoading={prs.isLoading}
        component={(prs) => {
          if (prs.pages[0].items.length === 0) {
            return <EmptyPrBreakdown />;
          }

          const totalPrs = prs.pages[0].totalCount;
          const totalPages = Math.ceil(totalPrs / NUM_PRS_TO_SHOW);

          return (
            <div className="flex gap-2 md:gap-0 md:group-hover:gap-4 transition-all w-full">
              <div
                className={cn("overflow-hidden flex-1")}
                style={{
                  height: `${pageHeight}px`,
                }}
              >
                <motion.div
                  animate={{
                    y: -currentPage * pageHeight,
                  }}
                  transition={{ duration: 0.2 }}
                  className={"flex flex-col"}
                >
                  {prs.pages
                    .flatMap((page) => page.items)
                    .map((pr, index) => (
                      <PrRow key={`${pr.prId}-${pr.userId}-${index}`} repo={repo} pr={pr} showModal />
                    ))}
                  {isFetchingNextPage &&
                    Array.from({ length: NUM_PRS_TO_SHOW }).map((_, index) => (
                      <LoadingPrRow key={index} />
                    ))}
                </motion.div>
              </div>
              {totalPrs > NUM_PRS_TO_SHOW && (
                <div
                  className={
                    "flex flex-col items-center gap-2 justify-between h-full md:opacity-0 md:group-hover:opacity-100 transition-all w-5 md:w-0 group-hover:w-5 pt-2 pb-4"
                  }
                  style={{
                    height: `${NUM_PRS_TO_SHOW * 36 + NUM_PRS_TO_SHOW * 8}px`,
                  }}
                >
                  <Button
                    onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                    disabled={currentPage === 0}
                    variant="ghost"
                    size="icon"
                    className="size-fit p-1"
                  >
                    <ChevronUp className="size-3" />
                  </Button>
                  <Progress
                    value={((currentPage + 1) / totalPages) * 100}
                    vertical
                    className="rotate-180 w-2"
                    indicatorColor="bg-primary"
                  />
                  <Button
                    onClick={() => {
                      if (currentPage === prs.pages.length - 1 && hasNextPage) {
                        fetchNextPage();
                      }
                      setCurrentPage(Math.min(totalPages - 1, currentPage + 1));
                    }}
                    disabled={
                      (currentPage === prs.pages.length - 1 && !hasNextPage) ||
                      (currentPage >= prs.pages.length - 1 &&
                        isFetchingNextPage)
                    }
                    variant="ghost"
                    size="icon"
                    className="size-fit p-1"
                  >
                    <ChevronDown className="size-3" />
                  </Button>
                </div>
              )}
            </div>
          );
        }}
        loadingComponent={<LoadingPrBreakdown />}
      />
    </div>
  );
};

const LoadingPrBreakdown: React.FC = () => {
  return (
    <div className="flex flex-col">
      {Array.from({ length: NUM_PRS_TO_SHOW }).map((_, index) => (
        <LoadingPrRow key={index} />
      ))}
    </div>
  );
};

const EmptyPrBreakdown: React.FC = () => {
  return (
    <VStack className="gap-2 h-full flex flex-col justify-center items-center p-4">
      <SearchX className="size-12" />
      <VStack className="gap-1">
        <h2 className="text-muted-foreground font-bold">No PRs Found</h2>
        <p className="text-sm text-muted-foreground">
          Try adjusting your time range to find more PRs.
        </p>
      </VStack>
    </VStack>
  );
};