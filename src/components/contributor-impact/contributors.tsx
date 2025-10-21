import { useAggregateCaptable } from "@/hooks/use-attribution";
import { UserIcon } from "lucide-react";
import React, { useEffect, useRef } from "react";
import { ContributorsList } from "./contributors-list";
import { SubCard } from "./sub-card";

interface Repository {
  owner: { login: string };
  name: string;
}

interface UserRepoSearchResult {
  id: number;
  login: string;
  avatar_url: string;
}

interface Props {
  repo: Repository;
  minTime: string;
  maxTime: string;
  filterUser: UserRepoSearchResult | undefined;
  setFilterUser: (user: UserRepoSearchResult | undefined) => void;
}

export const Contributors: React.FC<Props> = ({
  repo,
  minTime,
  maxTime,
  filterUser,
  setFilterUser,
}) => {
  const {
    data: captableData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAggregateCaptable(
    repo.owner.login,
    repo.name,
    {
      min_time: minTime,
      max_time: maxTime,
    },
    undefined,
    undefined,
    {
      enabled: true,
      initialPageParam: {
        page: 1,
        page_size: 4,
      },
    },
  );

  const cachedData = useRef(captableData);

  useEffect(() => {
    if (captableData) {
      cachedData.current = captableData;
    }
  }, [captableData]);

  // prefetch 2 extra pages
  useEffect(() => {
    const prefetchData = async () => {
      if (!isLoading && hasNextPage) {
        const prefetchPages = 3;
        for (let i = 0; i < prefetchPages - 1; i++) {
          if (!hasNextPage) break;
          await fetchNextPage();
        }
      }
    };

    prefetchData();
  }, [
    isLoading,
    hasNextPage,
    fetchNextPage,
    repo.owner.login,
    repo.name,
    minTime,
    maxTime,
  ]);

  return (
    <SubCard
      title="Contributors"
      description="Ranked by total impact score of their PRs in the selected time range"
      icon={<UserIcon className="w-4 h-4" />}
      isLoading={isLoading || isFetchingNextPage}
    >
      <ContributorsList
        users={{
          data: captableData ?? cachedData.current ?? null,
          isLoading: isLoading && !cachedData.current,
        }}
        filterUser={filterUser}
        setFilterUser={setFilterUser}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        minTime={minTime}
        maxTime={maxTime}
      />
    </SubCard>
  );
};
