"use client";

import { ContributorsList } from "@/components/contributor-impact/contributors-list";
import { Button } from "@/components/ui/button";
import { usePrRange } from "@/hooks/use-timeline-attribution";
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

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying || !prRange) return;

    // Calculate interval based on playback speed (500ms / speed)
    const intervalMs = Math.max(5, 500 / playbackSpeed);

    const interval = setInterval(() => {
      setCurrentPrNumber((prev) => {
        // Find next available PR number
        const currentIndex = prRange.prNumbers.indexOf(prev);
        if (
          currentIndex === -1 ||
          currentIndex >= prRange.prNumbers.length - 1
        ) {
          setIsPlaying(false);
          return prRange.prNumbers[prRange.prNumbers.length - 1];
        }
        return prRange.prNumbers[currentIndex + 1];
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, prRange, playbackSpeed]);

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

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!prRange) return;
    const index = parseInt(e.target.value);
    setCurrentPrNumber(prRange.prNumbers[index]);
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

  if (isLoadingRange) {
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
        {/* Preload Button */}
        {prRange && (
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
            <input
              type="range"
              min={1}
              max={100}
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseInt(e.target.value))}
              className="w-20 h-1 bg-muted rounded-lg appearance-none cursor-pointer speed-slider"
            />
            <span className="text-xs font-mono w-8 text-right">
              {playbackSpeed}x
            </span>
          </div>

          <div className="flex-1 flex items-center gap-4">
            <input
              type="range"
              min={0}
              max={prRange.prNumbers.length - 1}
              value={currentPrIndex}
              onChange={handleSliderChange}
              className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${
                  (currentPrIndex / (prRange.prNumbers.length - 1)) * 100
                }%, hsl(var(--muted)) ${
                  (currentPrIndex / (prRange.prNumbers.length - 1)) * 100
                }%, hsl(var(--muted)) 100%)`,
              }}
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
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Top 10 in {owner}/{repo}</h2>
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
      </div>

      {/* Slider styles */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: hsl(var(--primary));
          cursor: pointer;
          border: 2px solid hsl(var(--background));
        }

        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: hsl(var(--primary));
          cursor: pointer;
          border: 2px solid hsl(var(--background));
        }

        .speed-slider::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: hsl(var(--primary));
          cursor: pointer;
        }

        .speed-slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: hsl(var(--primary));
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
});

export default TimelinePage;
