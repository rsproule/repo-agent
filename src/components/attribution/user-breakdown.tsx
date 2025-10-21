'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Loader2, SearchX } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAggregateCaptable } from '@/hooks/use-attribution';
import { cn } from '@/lib/utils';
import type {
  AttributionOverrides,
  AttributionPreFilters,
  UserAttribution,
} from '@/lib/attribution';

interface Props {
  owner: string;
  repo: string;
  preFilters: AttributionPreFilters;
  overrides: AttributionOverrides;
  bgColor?: string;
  totalAmount?: number;
  isEnabled?: boolean;
}

export const UserBreakdown: React.FC<Props> = ({
  owner,
  repo,
  preFilters,
  overrides,
  bgColor = 'white',
  totalAmount,
  isEnabled = true,
}) => {
  const previousData = useRef<UserAttribution[]>([]);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAggregateCaptable(
    owner,
    repo,
    preFilters,
    undefined,
    overrides,
    {
      enabled: isEnabled,
      initialPageParam: {
        page: 1,
        page_size: 30,
      },
    },
  );

  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentRef = loadMoreRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasNextPage &&
          !isLoading &&
          !isFetchingNextPage
        ) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasNextPage, isLoading, isFetchingNextPage, fetchNextPage]);

  const flatData = useMemo(() => {
    const items = data?.pages.flatMap((page) => page.items) ?? [];
    if (items.length > 0) {
      previousData.current = items;
    }
    return items.length > 0 ? items : previousData.current;
  }, [data]);

  const totalCount = useMemo(() => {
    return data?.pages[0]?.totalCount;
  }, [data]);

  const maxAttribution = useMemo(() => {
    if (!flatData) return 0;
    return Math.max(
      ...flatData.map(
        (user) =>
          user.bucket0AggPct +
          user.bucket1AggPct +
          user.bucket2AggPct +
          user.bucket3AggPct,
      ),
    );
  }, [flatData]);

  if (!isEnabled) return null;

  return (
    <Card className="p-4">
      <div className="flex flex-col">
        <div className="sticky top-0 z-10">
          <div
            className={cn(
              'grid grid-cols-12 items-center gap-2 w-full text-xs font-semibold pb-2 h-7',
              totalAmount === undefined && 'grid-cols-10',
            )}
          >
            <div className="col-span-4 font-bold text-base">
              {isLoading && !totalCount ? (
                <div className="h-7 w-24 bg-gray-200 animate-pulse rounded" />
              ) : (
                `${totalCount} Users`
              )}
            </div>
            <div className="col-span-4 flex items-center justify-start text-gray-600">
              Attribution
            </div>
            <div className="col-span-2 flex items-center justify-center text-gray-600">
              Merged PRs
            </div>
            {totalAmount !== undefined && (
              <div className="col-span-2 flex items-center justify-center text-gray-600">
                Payout
              </div>
            )}
          </div>
        </div>

        {isLoading && flatData.length === 0 ? (
          <LoadingUserBreakdown />
        ) : flatData.length === 0 ? (
          <EmptyUserBreakdown />
        ) : (
          <div className="flex flex-col gap-1">
            {flatData
              .filter((user) => user.pct > 0)
              .map((user) => (
                <UserRow
                  key={user.user_id}
                  user={user}
                  maxAttribution={maxAttribution}
                  totalAmount={totalAmount}
                />
              ))}
            {isFetchingNextPage && (
              <div className="flex justify-center">
                <Loader2 className="size-4 animate-spin text-gray-400" />
              </div>
            )}
            {hasNextPage && <div ref={loadMoreRef} className="h-4" />}
          </div>
        )}
      </div>
    </Card>
  );
};

const UserRow: React.FC<{
  user: UserAttribution;
  maxAttribution: number;
  totalAmount?: number;
}> = ({ user, maxAttribution, totalAmount }) => {
  const totalPctWidth = maxAttribution > 0
    ? ((user.bucket0AggPct + user.bucket1AggPct + user.bucket2AggPct + user.bucket3AggPct) / maxAttribution) * 100
    : 0;

  const totalPRs = user.bucket0Count + user.bucket1Count + user.bucket2Count + user.bucket3Count;

  return (
    <div
      className={cn(
        'grid grid-cols-12 items-center gap-2 py-2 px-2 rounded hover:bg-gray-50',
        totalAmount === undefined && 'grid-cols-10',
      )}
    >
      <div className="col-span-4 text-sm font-medium">
        {user.userId}
      </div>
      <div className="col-span-4 relative">
        <div className="w-full bg-gray-200 rounded h-4 overflow-hidden">
          <div
            className="h-full flex"
            style={{ width: `${totalPctWidth}%` }}
          >
            <div
              className="bg-blue-500"
              style={{
                width: `${user.bucket0AggPct / maxAttribution * 100}%`,
              }}
            />
            <div
              className="bg-green-500"
              style={{
                width: `${user.bucket1AggPct / maxAttribution * 100}%`,
              }}
            />
            <div
              className="bg-yellow-500"
              style={{
                width: `${user.bucket2AggPct / maxAttribution * 100}%`,
              }}
            />
            <div
              className="bg-red-500"
              style={{
                width: `${user.bucket3AggPct / maxAttribution * 100}%`,
              }}
            />
          </div>
        </div>
        <div className="text-xs text-gray-600 mt-1">
          {(user.pct * 100).toFixed(1)}%
        </div>
      </div>
      <div className="col-span-2 flex items-center justify-center text-sm">
        {totalPRs}
      </div>
      {totalAmount !== undefined && (
        <div className="col-span-2 flex items-center justify-center text-sm font-medium">
          ${(user.pct * totalAmount).toFixed(2)}
        </div>
      )}
    </div>
  );
};

const LoadingUserBreakdown: React.FC = () => {
  const widths = useMemo(() => {
    const randomNums = Array.from({ length: 10 }, () => Math.random());
    const sum = randomNums.reduce((a, b) => a + b, 0);
    return randomNums.map((n) => (n / sum) * 100).sort((a, b) => b - a);
  }, []);

  const maxWidth = useMemo(() => Math.max(...widths), [widths]);

  return (
    <div className="flex flex-col gap-1">
      {widths.map((width, index) => (
        <div key={index} className="grid grid-cols-12 items-center gap-2 py-2">
          <div className="col-span-4">
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="col-span-4">
            <div
              className="h-4 bg-gray-200 rounded animate-pulse"
              style={{ width: `${(width / maxWidth) * 100}%` }}
            />
          </div>
          <div className="col-span-2">
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
};

const EmptyUserBreakdown: React.FC = () => {
  return (
    <div className="flex flex-col gap-4 bg-gray-50 rounded-md p-4 items-center">
      <SearchX className="size-12 text-gray-400" />
      <div className="flex flex-col gap-1 text-center">
        <h2 className="text-gray-600 font-bold">No Users Found</h2>
        <p className="text-sm text-gray-500">
          Try adjusting your filters to find more users.
        </p>
      </div>
    </div>
  );
};