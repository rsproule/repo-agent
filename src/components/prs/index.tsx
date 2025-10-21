import React, { useEffect, useMemo, useRef, useState } from "react";

import { GitPullRequest } from "lucide-react";

import { HStack } from "@/components/ui/stack";

import { SubCard } from "@/components/ui/sub-card";

import { PrList } from "@/components/prs/list";

import { BucketFilter } from "@/components/prs/filters/bucket";
import { UserFilter } from "@/components/prs/filters/user";

import {
  useAttributionByPr,
  useAttributionQuartiles,
} from "@/hooks/use-attribution";

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

interface Props {
  repo: Repository;
  minTime: string;
  maxTime: string;
  filterUser: UserRepoSearchResult | undefined;
  setFilterUser: (user: UserRepoSearchResult | undefined) => void;
}

export const TopPrs: React.FC<Props> = ({
  repo,
  minTime,
  maxTime,
  filterUser,
  setFilterUser,
}) => {
  const [filterBucket, setFilterBucket] = useState<number | undefined>(
    undefined,
  );

  const { data: quartiles, isLoading: isQuartilesLoading } =
    useAttributionQuartiles(repo.owner.login, repo.name, {
      min_time: minTime,
      max_time: maxTime,
    });

  const {
    data: attributionByPr,
    isLoading: isAttributionByPrLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useAttributionByPr(
    repo.owner.login,
    repo.name,
    {
      min_time: minTime,
      max_time: maxTime,
    },
    {
      user_id: filterUser?.id,
      init_bucket: filterBucket,
    },
    undefined,
    {
      enabled: true,
      initialPageParam: {
        page: 1,
        page_size: 4,
      },
    },
  );

  // prefetch 2 extra pages
  useEffect(() => {
    const prefetchData = async () => {
      if (!isAttributionByPrLoading && hasNextPage) {
        const prefetchPages = 3;
        // We already have the first page, so we need to fetch (prefetchPages - 1) more pages
        for (let i = 0; i < prefetchPages - 1; i++) {
          if (!hasNextPage) break;
          await fetchNextPage();
        }
      }
    };

    prefetchData();
  }, [
    isAttributionByPrLoading,
    hasNextPage,
    fetchNextPage,
    repo.owner.login,
    repo.name,
    minTime,
    maxTime,
  ]);

  const previousAttributionByPr = useRef(attributionByPr);

  const data = useMemo(() => {
    return attributionByPr ?? previousAttributionByPr.current;
  }, [attributionByPr]);

  useEffect(() => {
    if (attributionByPr) {
      previousAttributionByPr.current = attributionByPr;
    }
  }, [attributionByPr]);

  return (
    <SubCard
      title="PRs"
      description="Ranked by impact score"
      icon={<GitPullRequest className="size-4" />}
      rightItem={
        <HStack className="justify-end">
          <BucketFilter
            selectedBucket={filterBucket}
            setSelectedBucket={setFilterBucket}
            quartiles={{
              data: quartiles,
              isLoading: isQuartilesLoading,
            }}
          />
          <UserFilter
            repo={repo}
            selectedUser={filterUser}
            setSelectedUser={setFilterUser}
            startWindow={minTime}
            endWindow={maxTime}
          />
        </HStack>
      }
      isLoading={isAttributionByPrLoading || isFetchingNextPage}
    >
      <PrList
        repo={repo}
        prs={{
          data: data,
          isLoading:
            isAttributionByPrLoading && !previousAttributionByPr.current,
        }}
        filterUser={filterUser}
        filterBucket={filterBucket}
        minTime={minTime}
        maxTime={maxTime}
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
        isFetchingNextPage={isFetchingNextPage}
      />
    </SubCard>
  );
};