"use client";

import { ContributorsList } from "@/components/contributor-impact/contributors-list";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import useJobStatus from "@/hooks/use-job-status";
import { usePrRange } from "@/hooks/use-timeline-attribution";
import { useTimelineReadiness } from "@/hooks/use-timeline-readiness";
import type { PaginatedResponse, UserAttribution } from "@/lib/attribution";
import { calculateTimelineAttribution } from "@/lib/timeline-calculator";
import {
  ChevronsLeft,
  Download,
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Zap,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

const TimelinePage = React.memo(function TimelinePage() {
  const searchParams = useSearchParams();
  const owner = searchParams.get("owner") || "facebook";
  const repo = searchParams.get("repo") || "react";

  // Storage key for localStorage
  const storageKey = `timeline-${owner}-${repo}`;
  const scoresStorageKey = `timeline-scores-${owner}-${repo}`;

  // Fetch PR range
  const { data: prRange, isLoading: isLoadingRange } = usePrRange(owner, repo);

  // Initialize timeline state
  const [currentPrNumber, setCurrentPrNumber] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(10); // 1x to 100x
  const [isPreloading, setIsPreloading] = useState(false);
  const [justTriggered, setJustTriggered] = useState(false);
  const [skipLows, setSkipLows] = useState(true); // On by default

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
    refetch: refetchReadiness,
  } = useTimelineReadiness(owner, repo, {
    refetchInterval: isBucketingRunning || justTriggered ? 3000 : undefined, // Poll every 3s while running
  });

  // Refetch readiness when job completes
  useEffect(() => {
    if (!isBucketingRunning && justTriggered) {
      refetchReadiness();
    }
  }, [isBucketingRunning, justTriggered, refetchReadiness]);

  // Load preloaded data from localStorage on mount
  const [preloadedData, setPreloadedData] = useState<Record<
    number,
    UserAttribution[]
  > | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loadingProgress, setLoadingProgress] = useState<{
    loaded: number;
    total: number;
  } | null>(null);

  // Set initial PR number when range loads
  useEffect(() => {
    if (prRange && currentPrNumber === 0) {
      setCurrentPrNumber(prRange.minPrNumber);
    }
  }, [prRange, currentPrNumber]);

  // Store raw scores for calculation
  const [rawScores, setRawScores] = useState<Array<{
    prNumber: number;
    author: string;
    bucket: number;
    score: number;
  }> | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(scoresStorageKey);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Prefetch nearby PRs for smooth scrubbing
  const currentPrIndex = prRange
    ? prRange.prNumbers.indexOf(currentPrNumber)
    : 0;

  // Preload all timeline data (client-side calculation)
  const preloadTimeline = async () => {
    if (!prRange || isPreloading) return;

    setIsPreloading(true);
    setLoadingProgress({ loaded: 0, total: prRange.prNumbers.length });

    try {
      // Step 1: Load all raw scores (single fast query)
      let scoresToUse = rawScores;

      if (!scoresToUse) {
        const response = await fetch(
          `/api/attribution/timeline/scores?owner=${owner}&repo=${repo}`,
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        scoresToUse = data.scores;
        setRawScores(scoresToUse);

        // Store scores in localStorage
        try {
          localStorage.setItem(scoresStorageKey, JSON.stringify(scoresToUse));
        } catch (storageError) {
          console.warn("Failed to store scores in localStorage:", storageError);
        }
      }

      // Ensure we have scores before continuing
      if (!scoresToUse) {
        throw new Error("Failed to load scores");
      }

      // Step 2: Calculate attribution for each PR (client-side, fast)
      const allData: Record<number, UserAttribution[]> = preloadedData || {};

      // Find missing PRs
      const missingPrNumbers = prRange.prNumbers.filter(
        (prNum) => !allData[prNum],
      );

      if (missingPrNumbers.length === 0) {
        setIsPreloading(false);
        setLoadingProgress(null);
        return;
      }

      // Calculate in batches to avoid blocking UI
      const batchSize = 100;
      for (let i = 0; i < missingPrNumbers.length; i += batchSize) {
        const batch = missingPrNumbers.slice(i, i + batchSize);

        // Calculate attribution for this batch
        await new Promise((resolve) => setTimeout(resolve, 0)); // Yield to UI

        for (const prNumber of batch) {
          allData[prNumber] = calculateTimelineAttribution(
            scoresToUse,
            prNumber,
          );
        }

        setPreloadedData({ ...allData });
        setLoadingProgress({
          loaded:
            prRange.prNumbers.length -
            missingPrNumbers.length +
            Math.min(i + batchSize, missingPrNumbers.length),
          total: prRange.prNumbers.length,
        });
      }

      // Store calculated data in localStorage
      try {
        localStorage.setItem(storageKey, JSON.stringify(allData));
      } catch (storageError) {
        console.warn("Failed to store timeline in localStorage:", storageError);
      }

      setLoadingProgress(null);
    } catch (error) {
      console.error("Failed to preload timeline:", error);
      setLoadingProgress(null);
    } finally {
      setIsPreloading(false);
    }
  };

  // Clear cached timeline data
  const clearCache = () => {
    setPreloadedData(null);
    setRawScores(null);
    setLoadingProgress(null);
    try {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(scoresStorageKey);
    } catch {
      // Ignore errors
    }
  };

  // Trigger full bucket pipeline
  const [pipelineError, setPipelineError] = useState<string | null>(null);

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

        // Check if it's an "already running" error
        const errorMsg = data.error || `HTTP ${response.status}`;
        if (errorMsg.includes("already running")) {
          // Job is already running, just mark as triggered
          setJustTriggered(true);
          setTimeout(() => setJustTriggered(false), 30000);
        } else {
          setPipelineError(errorMsg);
        }
        return;
      }

      console.log("Pipeline triggered successfully:", data);
      setJustTriggered(true);

      // Clear the flag after 30 seconds (job should be detected by then)
      setTimeout(() => setJustTriggered(false), 30000);
    } catch (error) {
      console.error("Failed to trigger pipeline:", error);
      const errorMsg =
        error instanceof Error ? error.message : "Failed to trigger task";

      // Check if it's an "already running" error
      if (errorMsg.includes("already running")) {
        setJustTriggered(true);
        setTimeout(() => setJustTriggered(false), 30000);
      } else {
        setPipelineError(errorMsg);
      }
    }
  };

  const isPipelineRunningOrQueued = isBucketingRunning || justTriggered;

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying || !prRange) return;

    // Calculate interval based on playback speed (500ms / speed)
    const intervalMs = Math.max(5, 500 / playbackSpeed);

    const interval = setInterval(() => {
      setCurrentPrNumber((prev) => {
        // Find next available PR number
        let currentIndex = prRange.prNumbers.indexOf(prev);
        if (
          currentIndex === -1 ||
          currentIndex >= prRange.prNumbers.length - 1
        ) {
          setIsPlaying(false);
          return prRange.prNumbers[prRange.prNumbers.length - 1];
        }

        // If skipLows is enabled, find next PR with significant changes
        if (skipLows && preloadedData) {
          const currentTop10 = preloadedData[prev]
            ?.slice(0, 10)
            .map((u) => u.userId)
            .join(",");

          // Skip forward until we find a PR where top 10 changes
          for (let i = currentIndex + 1; i < prRange.prNumbers.length; i++) {
            const nextPr = prRange.prNumbers[i];
            const nextTop10 = preloadedData[nextPr]
              ?.slice(0, 10)
              .map((u) => u.userId)
              .join(",");

            // If top 10 contributors changed, use this PR
            if (nextTop10 && nextTop10 !== currentTop10) {
              return nextPr;
            }
          }

          // If no changes found, go to end
          setIsPlaying(false);
          return prRange.prNumbers[prRange.prNumbers.length - 1];
        }

        return prRange.prNumbers[currentIndex + 1];
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, prRange, playbackSpeed, skipLows, preloadedData]);

  // Navigation handlers
  const goToStart = () => {
    if (!prRange) return;
    setCurrentPrNumber(prRange.prNumbers[0]);
    setIsPlaying(false);
  };

  const goToPreviousPr = () => {
    if (!prRange) return;
    const currentIndex = prRange.prNumbers.indexOf(currentPrNumber);
    if (currentIndex > 0) {
      setCurrentPrNumber(prRange.prNumbers[currentIndex - 1]);
    }
  };

  const goToNextPr = () => {
    if (!prRange) return;
    const currentIndex = prRange.prNumbers.indexOf(currentPrNumber);
    if (currentIndex < prRange.prNumbers.length - 1) {
      setCurrentPrNumber(prRange.prNumbers[currentIndex + 1]);
    }
  };

  // Keep previous data while loading new data (prevents flash of loading)
  const [displayData, setDisplayData] = useState<
    PaginatedResponse<UserAttribution> | undefined
  >(undefined);

  // Use preloaded data if available
  useEffect(() => {
    if (preloadedData && preloadedData[currentPrNumber]) {
      setDisplayData({
        items: preloadedData[currentPrNumber],
        totalCount: preloadedData[currentPrNumber].length,
        page: 1,
        pageSize: 10,
        hasNext: false,
      });
    } else if (rawScores && currentPrNumber > 0) {
      // Calculate on-the-fly if we have raw scores but not cached result
      try {
        const calculated = calculateTimelineAttribution(
          rawScores,
          currentPrNumber,
        );
        setDisplayData({
          items: calculated,
          totalCount: calculated.length,
          page: 1,
          pageSize: 10,
          hasNext: false,
        });
      } catch (error) {
        console.error("Failed to calculate timeline:", error);
      }
    }
  }, [preloadedData, currentPrNumber, rawScores]);

  // Convert attribution data to InfiniteQuery format for ContributorsList
  const contributorsData = useMemo(() => {
    if (!displayData) return null;

    return {
      pages: [displayData],
      pageParams: [{ page: 1, page_size: 10 }],
    };
  }, [displayData]);

  if (isLoadingRange || isLoadingReadiness) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading timeline data...</p>
        </div>
      </div>
    );
  }

  if (!prRange) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-destructive">Failed to load PR range</p>
      </div>
    );
  }

  // Timeline is ready if we have ANY scored PRs (not requiring 100%)
  const isReady = (readiness?.scoredPRs ?? 0) > 0;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Contributors Timeline</h1>
        <p className="text-muted-foreground">
          {owner}/{repo}
        </p>
      </div>

      {/* Timeline Controls */}
      <div className="mb-8 space-y-4">
        {/* Show analysis progress if not at 100% */}
        {readiness && readiness.coverage < 100 && (
          <div className="flex items-center gap-3 p-3 bg-card rounded-lg border">
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isPipelineRunningOrQueued && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  <span className="text-sm font-medium">
                    {isPipelineRunningOrQueued
                      ? "Analyzing PRs"
                      : readiness.scoredPRs === 0
                      ? "Setup Required"
                      : "Analysis Incomplete"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {readiness.scoredPRs} / {readiness.totalMergedPRs} (
                  {readiness.coverage.toFixed(1)}%)
                </span>
              </div>

              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${readiness.coverage}%`,
                  }}
                />
              </div>

              {pipelineError && (
                <p className="text-xs text-destructive">{pipelineError}</p>
              )}
            </div>

            {!isPipelineRunningOrQueued && (
              <Button onClick={triggerFullPipeline} variant="default" size="sm">
                <Zap className="mr-2 h-4 w-4" />
                {readiness.scoredPRs === 0
                  ? "Start Analysis"
                  : "Complete Analysis"}
              </Button>
            )}
          </div>
        )}

        {/* Preload Button - Only show when ready */}
        {isReady && prRange && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
            <div className="flex-1">
              <p className="text-sm font-medium">
                {preloadedData &&
                Object.keys(preloadedData).length === prRange.prNumbers.length
                  ? "Timeline fully loaded"
                  : "Preload timeline for smooth playback"}
              </p>
              {loadingProgress ? (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {rawScores
                      ? `Calculating ${loadingProgress.loaded} / ${loadingProgress.total} PRs`
                      : `Loading PR data...`}
                  </p>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          (loadingProgress.loaded / loadingProgress.total) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {preloadedData ? (
                    <>
                      {Object.keys(preloadedData).length} /{" "}
                      {prRange.prNumbers.length} PRs ready
                      {Object.keys(preloadedData).length <
                        prRange.prNumbers.length && (
                        <>
                          {" "}
                          — Calculate{" "}
                          {prRange.prNumbers.length -
                            Object.keys(preloadedData).length}{" "}
                          more
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      Fast client-side calculation (~
                      {Math.round((prRange.prNumbers.length * 0.1) / 1024)} MB
                      download)
                    </>
                  )}
                </p>
              )}
            </div>
            {(!preloadedData ||
              Object.keys(preloadedData).length < prRange.prNumbers.length) && (
              <Button
                onClick={preloadTimeline}
                disabled={isPreloading}
                variant="default"
              >
                {isPreloading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    {preloadedData ? "Load More" : "Load Timeline"}
                  </>
                )}
              </Button>
            )}
            {preloadedData && (
              <Button
                onClick={clearCache}
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                Clear Cache
              </Button>
            )}
          </div>
        )}

        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={goToStart}
            disabled={currentPrIndex === 0}
            title="Go to beginning"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={goToPreviousPr}
            disabled={currentPrIndex === 0}
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={goToNextPr}
            disabled={currentPrIndex === prRange.prNumbers.length - 1}
          >
            <SkipForward className="h-4 w-4" />
          </Button>

          {/* Speed Control */}
          <div className="flex items-center gap-2 px-3 py-1 border rounded-md bg-background">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Speed:
            </span>
            <Slider
              value={[playbackSpeed]}
              onValueChange={(value: number[]) => setPlaybackSpeed(value[0])}
              min={1}
              max={100}
              step={1}
              className="w-20"
            />
            <span className="text-xs font-mono w-8 text-right">
              {playbackSpeed}x
            </span>
          </div>

          {/* Skip Lows Checkbox */}
          <div className="flex items-center gap-2 px-3 py-1 border rounded-md bg-background">
            <input
              type="checkbox"
              id="skip-lows"
              checked={skipLows}
              onChange={(e) => setSkipLows(e.target.checked)}
              className="rounded border-muted-foreground"
            />
            <label
              htmlFor="skip-lows"
              className="text-xs text-muted-foreground whitespace-nowrap cursor-pointer"
            >
              Skip unchanged
            </label>
          </div>

          <div className="flex-1 flex items-center gap-4">
            <Slider
              value={[currentPrIndex]}
              onValueChange={(value: number[]) => {
                if (prRange) {
                  setCurrentPrNumber(prRange.prNumbers[value[0]]);
                }
              }}
              min={0}
              max={prRange.prNumbers.length - 1}
              step={1}
              className="flex-1"
            />
            <div className="text-sm font-mono whitespace-nowrap min-w-[120px]">
              PR #{currentPrNumber}
              <span className="text-muted-foreground ml-2">
                ({currentPrIndex + 1} / {prRange.prNumbers.length})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Contributors List */}
      <div className="bg-card rounded-lg border p-6 relative">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            Top 10 contributors by <span className="text-primary">Impact</span>{" "}
            in {owner}/{repo}
          </h2>

          {/* Legend */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">Impact:</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-primary-15" />
              <span className="text-muted-foreground">Low</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-primary-30" />
              <span className="text-muted-foreground">Med</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-primary-60" />
              <span className="text-muted-foreground">High</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-primary-100" />
              <span className="text-muted-foreground">Max</span>
            </div>
          </div>
        </div>

        {!displayData && isPreloading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : contributorsData ? (
          <ContributorsList
            users={{
              data: contributorsData,
              isLoading: false,
            }}
            minTime=""
            maxTime=""
            usersToShow={10}
            showPagination={false}
          />
        ) : (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            No data available
          </div>
        )}

        {/* Merit Logo Watermark */}
        <div className="absolute bottom-4 right-4 opacity-70 transition-opacity">
          <img
            src="/logo/merit-dark.png"
            alt="Merit"
            className="h-5 dark:hidden"
          />
          <img
            src="/logo/merit-light.png"
            alt="Merit"
            className="h-5 hidden dark:block"
          />
        </div>
      </div>
    </div>
  );
});

export default TimelinePage;
