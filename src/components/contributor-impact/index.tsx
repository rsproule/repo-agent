"use client";

import { GitPullRequest } from "lucide-react";
import React, { useState } from "react";
import { TopPrs } from "../prs";
import { Contributors } from "./contributors";
import { PrGraph } from "./pr-graph";

interface Repository {
  owner: { login: string };
  name: string;
  created_at?: string;
}

interface UserFilter {
  id: number;
  login: string;
  avatar_url: string;
}

interface Props {
  repo: Repository;
}

export const ContributorImpact: React.FC<Props> = ({ repo }) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 items-center">
        <GitPullRequest className="size-6" />
        <h2 className="text-lg md:text-xl font-bold leading-none">
          Contributor Impact
        </h2>
        <div className="relative group">
          <div className="size-4 rounded-full border border-gray-300 flex items-center justify-center text-xs text-gray-500 cursor-help">
            ?
          </div>
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
            Merit analyzes the impact of each merged pull request and aggregates
            across all contributors.
          </div>
        </div>
      </div>
      <ContributorImpactBody repo={repo} />
    </div>
  );
};

const ContributorImpactBody: React.FC<{
  repo: Repository;
}> = ({ repo }) => {
  const [maxTime, setMaxTime] = useState(() => {
    return new Date();
  });

  const [minTime, setMinTime] = useState(() => {
    // Start with repo creation date or 30 days ago if no creation date
    return repo.created_at
      ? new Date(repo.created_at)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  });

  const [filterUser, setFilterUser] = useState<UserFilter | undefined>(
    undefined,
  );

  return (
    <div className="flex flex-col gap-2">
      <PrGraph
        repo={repo}
        minTime={minTime}
        maxTime={maxTime}
        setMinTime={setMinTime}
        setMaxTime={setMaxTime}
      />
      <div className="flex flex-col md:grid md:grid-cols-2 gap-2">
        <Contributors
          repo={repo}
          minTime={minTime.toISOString()}
          maxTime={maxTime.toISOString()}
          filterUser={filterUser}
          setFilterUser={setFilterUser}
        />
        <TopPrs
          repo={{ ...repo, id: 1 }}
          minTime={minTime.toISOString()}
          maxTime={maxTime.toISOString()}
          filterUser={
            filterUser
              ? {
                  id: filterUser.id.toString(),
                  login: filterUser.login,
                  avatar_url: filterUser.avatar_url,
                  total_prs: 0,
                  merged_prs: 0,
                }
              : undefined
          }
          setFilterUser={(user) =>
            setFilterUser(
              user
                ? {
                    id:
                      typeof user.id === "string" ? parseInt(user.id) : user.id,
                    login: user.login,
                    avatar_url: user.avatar_url,
                  }
                : undefined,
            )
          }
        />
      </div>
    </div>
  );
};
