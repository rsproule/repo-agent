import React, { useState, useMemo } from "react";

import { UserIcon, ChevronDown, ChevronUp, ChartPie } from "lucide-react";

import { SubCard } from "@/components/ui/sub-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { VStack } from "@/components/ui/stack";
import { AttributionBar } from "@/components/ui/attribution-bar";

import { cn } from "@/lib/utils";

const USERS_TO_SHOW = 4;

interface UserPct {
  user_id: string;
  login: string;
  pct: number;
  bucket_0_agg_pct: number;
  bucket_1_agg_pct: number;
  bucket_2_agg_pct: number;
  bucket_3_agg_pct: number;
}

interface ContributorsProps {
  title?: string;
  description?: string;
  users: UserPct[];
  isLoading?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
  filterUser?: { id: string; login: string };
  setFilterUser?: (user: { id: string; login: string } | undefined) => void;
}

export const Contributors: React.FC<ContributorsProps> = ({
  title = "Contributors",
  description = "Ranked by total impact score of their PRs in the selected time range",
  users = [],
  isLoading = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  fetchNextPage,
  filterUser,
  setFilterUser,
}) => {
  const [currentPage, setCurrentPage] = useState(0);

  const data = useMemo(() => {
    return users.sort((a: UserPct, b: UserPct) => b.pct - a.pct);
  }, [users]);

  const totalPages = Math.ceil(data.length / USERS_TO_SHOW);
  const rowHeight = 36;
  const gapHeight = 8;
  const pageHeight = USERS_TO_SHOW * rowHeight + USERS_TO_SHOW * gapHeight;

  const maxPct = useMemo(() => {
    if (data.length === 0) return 0;
    return Math.max(...data.map((item) => item.pct));
  }, [data]);

  const displayUsers = data.slice(
    currentPage * USERS_TO_SHOW,
    (currentPage + 1) * USERS_TO_SHOW
  );

  return (
    <SubCard
      title={title}
      description={description}
      icon={<UserIcon className="w-4 h-4" />}
      isLoading={isLoading || isFetchingNextPage}
    >
      {data.length === 0 && !isLoading ? (
        <EmptyContributors />
      ) : (
        <div className="flex gap-4 h-full items-center w-full max-w-full">
          <div className="flex-1 w-0 justify-center relative flex gap-4 md:gap-0 md:group-hover:gap-4 transition-all">
            <div
              className={cn(
                "overflow-hidden flex-1",
                data.length < USERS_TO_SHOW && "flex flex-col justify-center"
              )}
              style={{
                height: `${pageHeight}px`,
              }}
            >
              <div className="flex flex-col">
                {displayUsers.map((item: UserPct) => (
                  <OwnerRow
                    key={item.user_id}
                    user={item}
                    maxPct={maxPct}
                    style={{
                      marginBottom: `${gapHeight}px`,
                    }}
                    filterUser={filterUser}
                    setFilterUser={setFilterUser}
                  />
                ))}
                {isFetchingNextPage && (
                  <div className="flex flex-col">
                    {Array.from({ length: USERS_TO_SHOW }).map((_, index) => (
                      <BlankOwnerRow key={index} />
                    ))}
                  </div>
                )}
              </div>
            </div>
            {data.length > USERS_TO_SHOW && (
              <div
                className="flex flex-col justify-between h-full md:opacity-0 md:group-hover:opacity-100 transition-all w-5 md:w-0 group-hover:w-5 pt-2 pb-4 gap-2 items-center"
                style={{
                  height: `${pageHeight}px`,
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
                  className="rotate-180 w-2"
                  indicatorColor="bg-primary"
                />
                <Button
                  onClick={() => {
                    if (currentPage === totalPages - 1 && hasNextPage) {
                      fetchNextPage?.();
                    }
                    setCurrentPage(Math.min(totalPages - 1, currentPage + 1));
                  }}
                  disabled={currentPage >= totalPages - 1}
                  variant="ghost"
                  size="icon"
                  className="size-fit p-1"
                >
                  <ChevronDown className="size-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </SubCard>
  );
};

interface OwnerRowProps {
  user: UserPct;
  style?: React.CSSProperties;
  maxPct: number;
  filterUser?: { id: string; login: string };
  setFilterUser?: (user: { id: string; login: string } | undefined) => void;
}

const OwnerRow: React.FC<OwnerRowProps> = ({
  user,
  style,
  maxPct,
  filterUser,
  setFilterUser,
}) => {
  const onClick = setFilterUser
    ? () => {
        if (filterUser?.id === user.user_id) {
          setFilterUser?.(undefined);
        } else {
          setFilterUser?.({
            login: user.login,
            id: user.user_id,
          });
        }
      }
    : undefined;

  return (
    <div
      className={cn(
        "flex gap-2 overflow-hidden items-center transition-colors duration-200 px-1 rounded-md",
        onClick && "cursor-pointer hover:bg-foreground/5",
        filterUser?.id === user.user_id && "bg-foreground/5",
      )}
      style={style}
      onClick={onClick}
    >
      <div className="size-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
        {user.login.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex flex-1 overflow-hidden w-full flex-row items-center justify-between gap-4">
        <VStack className="items-start flex-1 gap-0">
          <div className="text-sm font-semibold truncate">{user.login}</div>
          <div className="text-xs text-primary">
            {user.pct.toLocaleString(undefined, {
              style: "percent",
              maximumFractionDigits: 2,
            })}
          </div>
        </VStack>
        <div className="w-32 md:w-48 -scale-x-100">
          <AttributionBar
            width={(user.pct / maxPct) * 100}
            bucketAttributions={[
              user.bucket_0_agg_pct,
              user.bucket_1_agg_pct,
              user.bucket_2_agg_pct,
              user.bucket_3_agg_pct,
            ]}
          />
        </div>
      </div>
    </div>
  );
};

interface BlankOwnerRowProps {
  style?: React.CSSProperties;
}

const BlankOwnerRow: React.FC<BlankOwnerRowProps> = ({ style }) => {
  return (
    <div
      className="flex gap-2 w-full max-w-full overflow-hidden items-center h-9 mb-2 px-1"
      style={style}
    >
      <Skeleton className="rounded-full size-7" />
      <div className="flex flex-1 overflow-hidden gap-1 w-full flex-row items-center justify-between">
        <VStack className="w-full items-start">
          <Skeleton className="h-[14px] w-24" />
          <Skeleton className="h-3 w-8" />
        </VStack>
        <Skeleton className="h-2 w-32 md:w-48" />
      </div>
    </div>
  );
};

const EmptyContributors: React.FC = () => {
  return (
    <VStack className="gap-2 h-full flex flex-col justify-center items-center p-4">
      <ChartPie className="size-12" />
      <VStack className="gap-1">
        <h2 className="text-muted-foreground font-bold">No Contributors</h2>
        <p className="text-sm text-muted-foreground">
          Try adjusting your time range to find more contributors.
        </p>
      </VStack>
    </VStack>
  );
};