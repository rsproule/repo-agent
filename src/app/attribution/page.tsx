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
import { useJobStatus } from "@/hooks/use-job-status";
import { useState } from "react";
import { Loader2, Database } from "lucide-react";

export default function AttributionPage() {
  const [owner, setOwner] = useState("merit-systems");
  const [repo, setRepo] = useState("echo");
  const isEnabled = !!(owner && repo); // Auto-enable when both fields have values

  // Get job status with faster polling
  const {
    isRunning,
    anyRunningJob
  } = useJobStatus(owner, repo, {
    refreshInterval: 2000, // Poll every 2 seconds
    enabled: !!owner && !!repo
  });

  const [syncLoading, setSyncLoading] = useState(false);

  // Fetch real repository metadata
  const { data: repoMetadata, isLoading: isLoadingRepo } =
    useRepositoryMetadata(owner, repo, { enabled: isEnabled });

  // Example filters and overrides
  const _preFilters: AttributionPreFilters = {
    // Can add min/max time filters here if needed
  };

  const _overrides: AttributionOverrides = {
    // Can add bucket percentage overrides here if needed
  };


  const handleSync = async () => {
    if (!owner || !repo) return;

    setSyncLoading(true);
    try {
      const response = await fetch('/api/trigger/sync-and-bucket-prs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, fullResync: false }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Sync pipeline started! Task ID:', data.taskId);
      } else {
        console.error('Failed to start sync:', data.error);
      }
    } catch (error) {
      console.error('Failed to start sync:', error);
    } finally {
      setSyncLoading(false);
    }
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
              {isEnabled && (
                <Button
                  onClick={handleSync}
                  disabled={!owner || !repo || syncLoading || isRunning}
                  size="sm"
                >
                  {syncLoading || isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Database className="h-4 w-4 mr-2" />
                  )}
                  {syncLoading || isRunning ? 'Syncing...' : 'Sync'}
                </Button>
              )}
            </div>

            {isRunning && (
              <div className="flex items-center gap-2 text-sm text-blue-600 pt-2">
                <span>
                  {anyRunningJob?.jobType === 'sync-prs' ? 'Syncing PRs...' :
                   anyRunningJob?.jobType === 'bucket-prs' ? 'Bucketing PRs...' :
                   anyRunningJob?.jobType === 'sync-and-bucket-prs' ? 'Running pipeline...' :
                   'Processing...'}
                </span>
              </div>
            )}
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
            Enter a repository owner and name above, then click &quot;Load
            Attribution Data&quot; to see the components in action.
          </p>
        </Card>
      )}
    </div>
  );
}