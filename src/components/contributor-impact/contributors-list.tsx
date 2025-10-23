import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AttributionBar } from "@/components/ui/attribution-bar";
import { VStack } from "@/components/ui/stack";
import { cn } from "@/lib/utils";

// Use existing API types
import type { UserAttribution, PaginatedResponse as ExistingPaginatedResponse } from "@/lib/attribution";

interface UserRepoSearchResult {
  id: number;
  login: string;
  avatar_url: string;
}

interface InfiniteQueryResult<T> {
  pages: ExistingPaginatedResponse<T>[];
  pageParams: any[];
}

interface Props {
  users: {
    data: InfiniteQueryResult<UserAttribution> | null;
    isLoading: boolean;
  };
  filterUser?: UserRepoSearchResult;
  setFilterUser?: (user: UserRepoSearchResult | undefined) => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
  minTime: string;
  maxTime: string;
}

const USERS_TO_SHOW = 4;

export const ContributorsList: React.FC<Props> = ({
  users,
  filterUser,
  setFilterUser,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}) => {
  const [currentPage, setCurrentPage] = useState(0);

  const flatUsers = useMemo(() => {
    if (!users.data) return [];
    return users.data.pages.flatMap((page) => page.items);
  }, [users]);

  const data = useMemo(() => {
    return flatUsers.sort((a: UserAttribution, b: UserAttribution) => b.pct - a.pct);
  }, [flatUsers]);

  const totalPages = Math.ceil(
    (users.data?.pages[0]?.totalCount ?? 0) / USERS_TO_SHOW,
  );

  const maxPct = useMemo(() => {
    if (!data.length) return 0;
    return Math.max(...data.map((item) => item.pct));
  }, [data]);

  const rowHeight = 36;
  const gapHeight = 8;
  const pageHeight = USERS_TO_SHOW * rowHeight + USERS_TO_SHOW * gapHeight;

  if (users.isLoading) {
    return (
      <div className="flex flex-col gap-1">
        {Array.from({ length: USERS_TO_SHOW }).map((_, index) => (
          <LoadingUserRow key={index} />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
        <p>No contributors found</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full items-center w-full max-w-full">
      <div className="flex-1 w-0 justify-center relative flex gap-4 md:gap-0">
        <div
          className="overflow-hidden flex-1"
          style={{ height: `${pageHeight}px` }}
        >
          <div
            className="flex flex-col transition-transform duration-200"
            style={{
              transform: `translateY(-${currentPage * pageHeight}px)`,
            }}
          >
            {data.map((user: UserAttribution) => (
              <UserRow
                key={user.userId}
                user={user}
                maxPct={maxPct}
                style={{ marginBottom: `${gapHeight}px` }}
                filterUser={filterUser}
                setFilterUser={setFilterUser}
              />
            ))}
            {isFetchingNextPage && (
              <div className="flex flex-col">
                {Array.from({ length: USERS_TO_SHOW }).map((_, index) => (
                  <LoadingUserRow key={index} />
                ))}
              </div>
            )}
          </div>
        </div>
        {(users.data?.pages?.[0]?.totalCount ?? 0) > USERS_TO_SHOW && (
          <div
            className="flex flex-col justify-between h-full opacity-100 transition-all w-5 pt-2 pb-4 gap-2 items-center"
            style={{ height: `${pageHeight}px` }}
          >
            <Button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              variant="ghost"
              size="sm"
              className="h-fit p-1"
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
                if (
                  currentPage === (users.data?.pages.length ?? 0) - 1 &&
                  hasNextPage
                ) {
                  fetchNextPage?.();
                }
                setCurrentPage(Math.min(totalPages - 1, currentPage + 1));
              }}
              disabled={
                (currentPage === (users.data?.pages.length ?? 0) - 1 &&
                  !hasNextPage) ||
                (currentPage >= (users.data?.pages.length ?? 0) - 1 &&
                  isFetchingNextPage)
              }
              variant="ghost"
              size="sm"
              className="h-fit p-1"
            >
              <ChevronDown className="size-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

interface UserRowProps {
  user: UserAttribution;
  style?: React.CSSProperties;
  maxPct: number;
  filterUser?: UserRepoSearchResult;
  setFilterUser?: (user: UserRepoSearchResult | undefined) => void;
}

const UserRow: React.FC<UserRowProps> = ({
  user,
  style,
  maxPct,
  filterUser,
  setFilterUser,
}) => {
  const onClick = setFilterUser
    ? () => {
        if (filterUser?.login === user.userId) {
          setFilterUser?.(undefined);
        } else {
          setFilterUser?.({
            login: user.userId,
            id: parseInt(user.userId) || 0,
            avatar_url: `https://github.com/${user.userId}.png`,
          });
        }
      }
    : undefined;

  return (
    <div
      className={cn(
        "flex gap-2 overflow-hidden items-center transition-colors duration-200 px-1 rounded-md",
        onClick && "cursor-pointer hover:bg-foreground/5",
        filterUser?.login === user.userId && "bg-foreground/5",
      )}
      style={style}
      onClick={onClick}
    >
      <Avatar className="size-7">
        <AvatarImage src={`https://github.com/${user.userId}.png`} />
        <AvatarFallback>{user.userId.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex flex-1 overflow-hidden w-full flex-row items-center justify-between gap-4">
        <VStack className="items-start flex-1 gap-0">
          <div className="text-sm font-semibold truncate">{user.userId}</div>
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
              user.bucket0AggPct,
              user.bucket1AggPct,
              user.bucket2AggPct,
              user.bucket3AggPct,
            ]}
          />
        </div>
      </div>
    </div>
  );
};

const LoadingUserRow: React.FC = () => {
  return (
    <div
      className="flex gap-2 w-full max-w-full overflow-hidden items-center px-1"
      style={{ height: '36px', marginBottom: '8px' }}
    >
      <div className="size-7 bg-muted rounded-full animate-pulse" />
      <div className="flex flex-1 overflow-hidden gap-1 w-full flex-row items-center justify-between">
        <VStack className="w-full items-start">
          <div className="h-[14px] w-24 bg-muted rounded animate-pulse" />
          <div className="h-3 w-8 bg-muted rounded animate-pulse" />
        </VStack>
        <div className="h-2 w-32 md:w-48 bg-muted rounded animate-pulse" />
      </div>
    </div>
  );
};