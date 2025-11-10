"use client";

import RepoQueryForm from "@/app/components/repo-query-form";
import RepoSyncManager from "@/app/components/repo-sync-manager";
import { ContributorsList } from "@/components/contributor-impact/contributors-list";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { PaginatedResponse, UserAttribution } from "@/lib/attribution";
import { calculateTimelineAttributionAgg } from "@/lib/timeline-calculator-agg";
import {
  ChevronsLeft,
  Download,
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

interface PrSequenceItem {
  sequenceNumber: number;
  owner: string;
  repo: string;
  prNumber: number;
  mergedAt: string | null;
}

interface PrSequenceRange {
  minSequenceNumber: number;
  maxSequenceNumber: number;
  prSequence: PrSequenceItem[];
  totalCount: number;
}

interface RepoWithWeight {
  owner: string;
  repo: string;
  weight: number;
}

const TimelineAggPage = React.memo(function TimelineAggPage() {
  const searchParams = useSearchParams();
  const reposParam = searchParams.get("repos") || "";

  // Parse repos from URL with weights
  const repos = useMemo(() => {
    if (!reposParam) return [];
    const parsed = reposParam
      .split(",")
      .map((r) => {
        const trimmed = r.trim();
        // Parse format: owner/repo or owner/repo:weight
        const [repoPath, weightStr] = trimmed.split(":");
        const [owner, repo] = repoPath.split("/");
        const weight = weightStr ? parseFloat(weightStr) : 1.0;
        return { owner, repo, weight };
      })
      .filter((r) => r.owner && r.repo);

    console.log("[Timeline Page] Parsed repos from URL:", parsed);
    return parsed;
  }, [reposParam]);

  // Storage keys for localStorage (include weights to invalidate cache when weights change)
  const storageKey = `timeline-agg-${repos
    .map((r) => `${r.owner}-${r.repo}-${r.weight}`)
    .join("-")}`;
  const scoresStorageKey = `timeline-agg-scores-${repos
    .map((r) => `${r.owner}-${r.repo}`)
    .join("-")}`;
  const sequenceStorageKey = `timeline-agg-sequence-${repos
    .map((r) => `${r.owner}-${r.repo}`)
    .join("-")}`;

  // Fetch PR sequence
  const [prSequence, setPrSequence] = useState<PrSequenceRange | null>(null);
  const [isLoadingSequence, setIsLoadingSequence] = useState(false);

  useEffect(() => {
    if (repos.length === 0) return;

    const fetchSequence = async () => {
      setIsLoadingSequence(true);
      try {
        // Try to load from cache first
        const cached = localStorage.getItem(sequenceStorageKey);
        if (cached) {
          setPrSequence(JSON.parse(cached));
          setIsLoadingSequence(false);
          return;
        }

        const response = await fetch(
          `/api/prs/range-agg?repos=${encodeURIComponent(reposParam)}`,
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setPrSequence(data);

        // Cache the sequence
        try {
          localStorage.setItem(sequenceStorageKey, JSON.stringify(data));
        } catch (e) {
          console.warn("Failed to cache sequence:", e);
        }
      } catch (error) {
        console.error("Failed to fetch PR sequence:", error);
      } finally {
        setIsLoadingSequence(false);
      }
    };

    fetchSequence();
  }, [reposParam, repos.length, sequenceStorageKey]);

  // Initialize timeline state
  const [currentSequenceNumber, setCurrentSequenceNumber] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(10);
  const [isPreloading, setIsPreloading] = useState(false);

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

  // Set initial sequence number when range loads
  useEffect(() => {
    if (prSequence && currentSequenceNumber === 1) {
      setCurrentSequenceNumber(prSequence.minSequenceNumber);
    }
  }, [prSequence, currentSequenceNumber]);

  // Store raw scores for calculation
  const [rawScores, setRawScores] = useState<Array<{
    prNumber: number;
    author: string;
    bucket: number;
    score: number;
    owner: string;
    repo: string;
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
  const currentSequenceIndex = prSequence ? currentSequenceNumber - 1 : 0;

  // Preload all timeline data (client-side calculation)
  const preloadTimeline = async () => {
    if (!prSequence || isPreloading) return;

    setIsPreloading(true);
    setLoadingProgress({ loaded: 0, total: prSequence.totalCount });

    try {
      // Step 1: Load all raw scores (single fast query)
      let scoresToUse = rawScores;

      if (!scoresToUse) {
        const response = await fetch(
          `/api/attribution/timeline-agg/scores?repos=${encodeURIComponent(
            reposParam,
          )}`,
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

      // Step 2: Calculate attribution for each sequence number (client-side, fast)
      const allData: Record<number, UserAttribution[]> = preloadedData || {};

      // Find missing sequence numbers
      const allSequenceNumbers = Array.from(
        { length: prSequence.totalCount },
        (_, i) => i + 1,
      );
      const missingSequenceNumbers = allSequenceNumbers.filter(
        (seqNum) => !allData[seqNum],
      );

      if (missingSequenceNumbers.length === 0) {
        setIsPreloading(false);
        setLoadingProgress(null);
        return;
      }

      // Calculate in batches to avoid blocking UI
      const batchSize = 50;
      for (let i = 0; i < missingSequenceNumbers.length; i += batchSize) {
        const batch = missingSequenceNumbers.slice(i, i + batchSize);

        // Calculate attribution for this batch
        await new Promise((resolve) => setTimeout(resolve, 0)); // Yield to UI

        for (const seqNum of batch) {
          // Log first calculation to verify weights
          if (seqNum === batch[0] && i === 0) {
            console.log(
              "[Timeline Page] Calculating with repos:",
              repos.map((r) => `${r.owner}/${r.repo}:${r.weight}`),
            );
          }

          allData[seqNum] = calculateTimelineAttributionAgg(
            scoresToUse,
            prSequence.prSequence,
            seqNum,
            repos, // Pass repos with weights
          );
        }

        setPreloadedData({ ...allData });
        setLoadingProgress({
          loaded:
            prSequence.totalCount -
            missingSequenceNumbers.length +
            Math.min(i + batchSize, missingSequenceNumbers.length),
          total: prSequence.totalCount,
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
    setPrSequence(null);
    setLoadingProgress(null);
    try {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(scoresStorageKey);
      localStorage.removeItem(sequenceStorageKey);
    } catch {
      // Ignore errors
    }
  };

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying || !prSequence) return;

    // Calculate interval based on playback speed (500ms / speed)
    const intervalMs = Math.max(5, 500 / playbackSpeed);

    const interval = setInterval(() => {
      setCurrentSequenceNumber((prev) => {
        const currentIndex = prev - 1;
        if (currentIndex >= prSequence.totalCount - 1) {
          setIsPlaying(false);
          return prSequence.totalCount;
        }

        // Always play through sequentially - never skip
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, prSequence, playbackSpeed]);

  // Navigation handlers
  const goToStart = () => {
    if (!prSequence) return;
    setCurrentSequenceNumber(1);
    setIsPlaying(false);
  };

  const goToPrevious = () => {
    if (!prSequence) return;
    if (currentSequenceNumber > 1) {
      setCurrentSequenceNumber(currentSequenceNumber - 1);
    }
  };

  const goToNext = () => {
    if (!prSequence) return;
    if (currentSequenceNumber < prSequence.totalCount) {
      setCurrentSequenceNumber(currentSequenceNumber + 1);
    }
  };

  // Keep previous data while loading new data (prevents flash of loading)
  const [displayData, setDisplayData] = useState<
    PaginatedResponse<UserAttribution> | undefined
  >(undefined);

  // Use preloaded data if available
  useEffect(() => {
    if (preloadedData && preloadedData[currentSequenceNumber]) {
      setDisplayData({
        items: preloadedData[currentSequenceNumber],
        totalCount: preloadedData[currentSequenceNumber].length,
        page: 1,
        pageSize: 10,
        hasNext: false,
      });
    } else if (rawScores && prSequence && currentSequenceNumber > 0) {
      // Calculate on-the-fly if we have raw scores but not cached result
      try {
        console.log(
          "[Timeline Page] On-the-fly calculation with repos:",
          repos.map((r) => `${r.owner}/${r.repo}:${r.weight}`),
        );

        const calculated = calculateTimelineAttributionAgg(
          rawScores,
          prSequence.prSequence,
          currentSequenceNumber,
          repos, // Pass repos with weights
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
  }, [preloadedData, currentSequenceNumber, rawScores, prSequence, repos]);

  // Convert attribution data to InfiniteQuery format for ContributorsList
  const contributorsData = useMemo(() => {
    if (!displayData) return null;

    return {
      pages: [displayData],
      pageParams: [{ page: 1, page_size: 10 }],
    };
  }, [displayData]);

  // Get current PR info
  const currentPr = prSequence?.prSequence[currentSequenceIndex];

  if (repos.length === 0) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Aggregated Contributors Timeline
            </h1>
            <p className="text-muted-foreground">
              Add repositories to view their combined contribution timeline
            </p>
          </div>

          <RepoQueryForm />

          <div className="mt-8 p-4 bg-muted/30 rounded-lg border">
            <h3 className="font-medium mb-2">How it works</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Add multiple repositories using the owner/repo format</li>
              <li>
                Adjust weight multipliers to emphasize certain repositories
              </li>
              <li>
                PRs from all repositories are combined into a single timeline
              </li>
              <li>Timeline is sorted by merge date across all repos</li>
              <li>
                View how contributors' impact evolves across multiple projects
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (isLoadingSequence) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading timeline data...</p>
        </div>
      </div>
    );
  }

  if (!prSequence) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-destructive">Failed to load PR sequence</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          Aggregated Contributors Timeline
        </h1>
        <p className="text-sm text-muted-foreground">
          {prSequence.totalCount} merged PRs across {repos.length} repositories
        </p>
      </div>

      {/* Repo Management Form */}
      <div className="mb-6">
        <RepoQueryForm />
      </div>

      {/* Repo Sync Manager */}
      <div className="mb-6">
        <RepoSyncManager repos={repos} />
      </div>

      {/* Timeline Controls */}
      <div className="mb-8 space-y-4">
        {/* Preload Button */}
        {prSequence && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
            <div className="flex-1">
              <p className="text-sm font-medium">
                {preloadedData &&
                Object.keys(preloadedData).length === prSequence.totalCount
                  ? "Timeline fully loaded"
                  : "Preload timeline for smooth playback"}
              </p>
              {loadingProgress ? (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {rawScores
                      ? `Calculating ${loadingProgress.loaded} / ${loadingProgress.total} sequences`
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
                      {prSequence.totalCount} sequences ready
                      {Object.keys(preloadedData).length <
                        prSequence.totalCount && (
                        <>
                          {" "}
                          — Calculate{" "}
                          {prSequence.totalCount -
                            Object.keys(preloadedData).length}{" "}
                          more
                        </>
                      )}
                    </>
                  ) : (
                    <>Fast client-side calculation</>
                  )}
                </p>
              )}
            </div>
            {(!preloadedData ||
              Object.keys(preloadedData).length < prSequence.totalCount) && (
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
            disabled={currentSequenceIndex === 0}
            title="Go to beginning"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={goToPrevious}
            disabled={currentSequenceIndex === 0}
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
            onClick={goToNext}
            disabled={currentSequenceNumber >= prSequence.totalCount}
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

          <div className="flex-1 flex items-center gap-4">
            <Slider
              value={[currentSequenceIndex]}
              onValueChange={(value: number[]) => {
                setCurrentSequenceNumber(value[0] + 1);
              }}
              min={0}
              max={prSequence.totalCount - 1}
              step={1}
              className="flex-1"
            />
            <div className="text-sm font-mono whitespace-nowrap min-w-[180px]">
              {currentPr && (
                <div className="text-xs">
                  <div className="font-medium">
                    {currentPr.owner}/{currentPr.repo} #{currentPr.prNumber}
                  </div>
                  <div className="text-muted-foreground">
                    ({currentSequenceNumber} / {prSequence.totalCount})
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contributors List */}
      <div className="bg-card rounded-lg border p-6 relative">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            Top 10 x402 contributors by PR{" "}
            <span className="text-primary">Impact</span>
          </h2>

          {/* Legend */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">Impact:</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-primary-30" />
              <span className="text-muted-foreground">Low</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-primary-60" />
              <span className="text-muted-foreground">Med</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-primary-100" />
              <span className="text-muted-foreground">High</span>
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
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-70 transition-opacity">
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

export default TimelineAggPage;
