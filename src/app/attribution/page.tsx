"use client";

import { ContributorImpact } from "@/components/contributor-impact";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  AttributionOverrides,
  AttributionPreFilters,
} from "@/lib/attribution";
import { useRepositoryMetadata } from "@/hooks/use-attribution";
import { useState } from "react";

export default function AttributionPage() {
  const [owner, setOwner] = useState("merit-systems");
  const [repo, setRepo] = useState("echo");
  const [isEnabled, setIsEnabled] = useState(false);

  // Fetch real repository metadata
  const { data: repoMetadata, isLoading: isLoadingRepo } =
    useRepositoryMetadata(owner, repo, { enabled: isEnabled });

  // Example filters and overrides
  const preFilters: AttributionPreFilters = {
    // Can add min/max time filters here if needed
  };

  const overrides: AttributionOverrides = {
    // Can add bucket percentage overrides here if needed
  };

  const handleFetch = () => {
    setIsEnabled(true);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Attribution Components Demo</h1>
        <p className="text-gray-600">
          This page demonstrates the attribution components that show PR
          contribution data.
        </p>

        <Card className="p-4">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Repository Settings</h2>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label
                  htmlFor="owner"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Owner
                </label>
                <Input
                  id="owner"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="Repository owner"
                />
              </div>
              <div className="flex-1">
                <label
                  htmlFor="repo"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Repository
                </label>
                <Input
                  id="repo"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="Repository name"
                />
              </div>
              <Button onClick={handleFetch} disabled={!owner || !repo}>
                Load Attribution Data
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {isEnabled && (
        <div className="space-y-6">
          {isLoadingRepo ? (
            <Card className="p-8 text-center">
              <p className="text-gray-500">Loading repository data...</p>
            </Card>
          ) : repoMetadata ? (
            <ContributorImpact repo={repoMetadata} />
          ) : (
            <Card className="p-8 text-center">
              <p className="text-red-500">
                No PR data found for {owner}/{repo}. Make sure the repository
                exists and has merged PRs.
              </p>
            </Card>
          )}
        </div>
      )}

      {!isEnabled && (
        <Card className="p-8 text-center">
          <p className="text-gray-500 text-lg">
            Enter a repository owner and name above, then click "Load
            Attribution Data" to see the components in action.
          </p>
        </Card>
      )}
    </div>
  );
}
