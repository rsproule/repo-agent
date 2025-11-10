'use client';

import { Button } from '@/components/ui/button';
import useJobStatus from '@/hooks/use-job-status';
import { useTimelineReadiness } from '@/hooks/use-timeline-readiness';
import { Loader2, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface RepoSyncItemProps {
  owner: string;
  repo: string;
  weight?: number;
}

function RepoSyncItem({ owner, repo, weight = 1.0 }: RepoSyncItemProps) {
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [justTriggered, setJustTriggered] = useState(false);

  // Track bucket job status
  const { isRunning: isBucketingRunning, bucketJob } = useJobStatus(
    owner,
    repo,
    {
      refreshInterval: 3000,
    },
  );

  // Check timeline readiness (all PRs bucketed)
  const {
    data: readiness,
    isLoading: isLoadingReadiness,
  } = useTimelineReadiness(owner, repo, {
    refetchInterval: isBucketingRunning || justTriggered ? 3000 : undefined,
  });

  const triggerFullPipeline = async () => {
    setPipelineError(null);

    try {
      console.log("Triggering full pipeline for", owner, repo);

      const response = await fetch("/api/trigger/sync-and-bucket-prs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          fullResync: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Pipeline trigger failed:", data);

        const errorMsg = data.error || `HTTP ${response.status}`;
        if (errorMsg.includes("already running")) {
          setJustTriggered(true);
          setTimeout(() => setJustTriggered(false), 30000);
        } else {
          setPipelineError(errorMsg);
        }
        return;
      }

      console.log("Pipeline triggered successfully:", data);
      setJustTriggered(true);
      setTimeout(() => setJustTriggered(false), 30000);
    } catch (error) {
      console.error("Failed to trigger pipeline:", error);
      const errorMsg =
        error instanceof Error ? error.message : "Failed to trigger task";

      if (errorMsg.includes("already running")) {
        setJustTriggered(true);
        setTimeout(() => setJustTriggered(false), 30000);
      } else {
        setPipelineError(errorMsg);
      }
    }
  };

  const isPipelineRunningOrQueued = isBucketingRunning || justTriggered;

  if (isLoadingReadiness) {
    return (
      <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm font-medium">
            {owner}/{repo}
          </span>
        </div>
      </div>
    );
  }

  const coverage = readiness?.coverage ?? 0;
  const scoredPRs = readiness?.scoredPRs ?? 0;
  const totalPRs = readiness?.totalMergedPRs ?? 0;

  return (
    <div className="flex items-center gap-3 p-3 bg-card rounded-lg border">
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isPipelineRunningOrQueued ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : coverage === 100 ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : coverage > 0 ? (
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">
              {owner}/{repo}
            </span>
            {weight !== 1.0 && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {weight}×
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {scoredPRs} / {totalPRs} PRs ({coverage.toFixed(1)}%)
          </span>
        </div>

        <div className="w-full bg-muted rounded-full h-1.5">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-500"
            style={{
              width: `${coverage}%`,
            }}
          />
        </div>

        {pipelineError && (
          <p className="text-xs text-destructive">{pipelineError}</p>
        )}
      </div>

      {!isPipelineRunningOrQueued && coverage < 100 && (
        <Button onClick={triggerFullPipeline} variant="default" size="sm">
          <Zap className="mr-2 h-4 w-4" />
          {scoredPRs === 0 ? "Analyze" : "Complete"}
        </Button>
      )}

      {isPipelineRunningOrQueued && (
        <div className="text-xs text-muted-foreground px-3">
          Running...
        </div>
      )}
    </div>
  );
}

interface RepoSyncManagerProps {
  repos: Array<{ owner: string; repo: string; weight?: number }>;
}

export default function RepoSyncManager({ repos }: RepoSyncManagerProps) {
  const [expanded, setExpanded] = useState(false);

  if (repos.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Repository Analysis Status</h3>
        {repos.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-xs"
          >
            {expanded ? 'Show Less' : `Show All (${repos.length})`}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {(expanded ? repos : repos.slice(0, 3)).map((repo, idx) => (
          <RepoSyncItem
            key={`${repo.owner}/${repo.repo}`}
            owner={repo.owner}
            repo={repo.repo}
            weight={repo.weight}
          />
        ))}
      </div>

      {!expanded && repos.length > 3 && (
        <p className="text-xs text-muted-foreground text-center">
          And {repos.length - 3} more...
        </p>
      )}
    </div>
  );
}

