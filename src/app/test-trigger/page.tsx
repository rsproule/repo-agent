"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import { PRTriageTable } from "../components/pr-triage-table";

type PRAnalysis = {
  summary: string;
  relevance: "high" | "medium" | "low";
  category: string;
  impact: {
    scope: string[];
    risk: "high" | "medium" | "low";
  };
  filesChanged: {
    total: number;
    additions: number;
    deletions: number;
    keyFiles: string[];
  };
  recommendations: string[];
  aiGenerated?: {
    probability: number;
    confidence: "high" | "medium" | "low";
    reasoning: string;
  };
};

type PRResult = {
  number: number;
  title: string;
  author: string;
  url: string;
  created_at: string;
  state: string;
  filesChanged: number;
  analysis?: PRAnalysis;
};

type TriageStats = {
  analyzed: number;
  skipped: number;
  failed: number;
};

export default function TestTriggerPage() {
  const [repository, setRepository] = useState("merit-systems/echo");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success?: boolean;
    message?: string;
    taskId?: string;
    error?: string;
    totalPRs?: number;
    stats?: TriageStats;
    prs?: PRResult[];
  } | null>(null);

  // PR Sync state
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success?: boolean;
    totalSynced?: number;
    tableStats?: {
      total: number;
      open: number;
      closed: number;
      merged: number;
    };
    latestPR?: {
      number: number;
      title: string;
      author: string;
      url: string;
    };
    error?: string;
  } | null>(null);

  // PR Bucket state
  const [bucketLoading, setBucketLoading] = useState(false);
  const [bucketResult, setBucketResult] = useState<{
    success?: boolean;
    totalProcessed?: number;
    totalCost?: number;
    runId?: string;
    distribution?: {
      bucket0: number;
      bucket1: number;
      bucket2: number;
      bucket3: number;
    };
    error?: string;
  } | null>(null);

  const handleTrigger = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/trigger/pr-triage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repository }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({ error: data.error || "Failed to trigger task" });
      } else {
        setResult(data);
      }
    } catch (error) {
      setResult({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncPRs = async () => {
    setSyncLoading(true);
    setSyncResult(null);

    try {
      const response = await fetch("/api/test/sync-prs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repository }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSyncResult({ error: data.error || "Failed to sync PRs" });
      } else {
        setSyncResult(data);
      }
    } catch (error) {
      setSyncResult({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleBucketPRs = async () => {
    setBucketLoading(true);
    setBucketResult(null);

    try {
      const response = await fetch("/api/test/bucket-prs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repository, fullResync: false }),
      });

      const data = await response.json();

      if (!response.ok) {
        setBucketResult({ error: data.error || "Failed to bucket PRs" });
      } else {
        setBucketResult(data);
      }
    } catch (error) {
      setBucketResult({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setBucketLoading(false);
    }
  };

  const handleFullResync = async () => {
    if (
      !confirm(
        "⚠️ This will re-classify ALL PRs from scratch. This can be expensive! Continue?",
      )
    ) {
      return;
    }

    setBucketLoading(true);
    setBucketResult(null);

    try {
      const response = await fetch("/api/test/bucket-prs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repository, fullResync: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        setBucketResult({ error: data.error || "Failed to bucket PRs" });
      } else {
        setBucketResult(data);
      }
    } catch (error) {
      setBucketResult({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setBucketLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10 max-w-[95vw] space-y-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Test PR Sync</CardTitle>
          <CardDescription>
            Sync PRs from GitHub to the database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="sync-repository" className="text-sm font-medium">
              Repository (owner/repo)
            </label>
            <Input
              id="sync-repository"
              type="text"
              placeholder="owner/repo"
              value={repository}
              onChange={(e) => setRepository(e.target.value)}
              disabled={syncLoading}
            />
          </div>

          <Button
            onClick={handleSyncPRs}
            disabled={syncLoading || !repository}
            className="w-full"
          >
            {syncLoading ? "Syncing..." : "Sync PRs"}
          </Button>

          {syncResult && (
            <div className="space-y-4">
              {syncResult.error ? (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                  <p className="font-semibold text-red-800">Error</p>
                  <p className="text-sm text-red-600">{syncResult.error}</p>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                    <p className="font-semibold text-green-800">
                      ✅ Sync completed successfully!
                    </p>
                    <p className="text-sm text-green-600 mt-1">
                      Total PRs synced: {syncResult.totalSynced}
                    </p>
                    {syncResult.latestPR && (
                      <div className="mt-2 text-sm text-green-700">
                        <p className="font-medium">Latest PR:</p>
                        <p>
                          #{syncResult.latestPR.number} -{" "}
                          {syncResult.latestPR.title}
                        </p>
                        <p>Author: {syncResult.latestPR.author}</p>
                        <a
                          href={syncResult.latestPR.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View PR →
                        </a>
                      </div>
                    )}
                  </div>

                  {syncResult.tableStats && (
                    <div>
                      <h3 className="font-semibold mb-2">
                        PRs in Database Table
                      </h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>State</TableHead>
                            <TableHead className="text-right">Count</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">
                              Total PRs
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {syncResult.tableStats.total}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Open</TableCell>
                            <TableCell className="text-right">
                              {syncResult.tableStats.open}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Closed</TableCell>
                            <TableCell className="text-right">
                              {syncResult.tableStats.closed}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Merged</TableCell>
                            <TableCell className="text-right">
                              {syncResult.tableStats.merged}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Test PR Bucketing</CardTitle>
          <CardDescription>
            Classify PRs by complexity/impact (0-3 buckets)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="bucket-repository" className="text-sm font-medium">
              Repository (owner/repo)
            </label>
            <Input
              id="bucket-repository"
              type="text"
              placeholder="owner/repo"
              value={repository}
              onChange={(e) => setRepository(e.target.value)}
              disabled={bucketLoading}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleBucketPRs}
              disabled={bucketLoading || !repository}
              className="w-full"
            >
              {bucketLoading ? "Classifying..." : "Bucket New PRs"}
            </Button>
            <Button
              onClick={handleFullResync}
              disabled={bucketLoading || !repository}
              variant="destructive"
              className="w-full"
            >
              {bucketLoading ? "Re-classifying..." : "Full Re-sync"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            <strong>Bucket New PRs:</strong> Only classify unclassified PRs
            (recommended)
            <br />
            <strong>Full Re-sync:</strong> Re-classify ALL PRs from scratch
            (expensive!)
          </p>

          {bucketResult && (
            <div className="space-y-4">
              {bucketResult.error ? (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                  <p className="font-semibold text-red-800">Error</p>
                  <p className="text-sm text-red-600">{bucketResult.error}</p>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                    <p className="font-semibold text-green-800">
                      ✅ Classification completed successfully!
                    </p>
                    <p className="text-sm text-green-600 mt-1">
                      Total PRs classified: {bucketResult.totalProcessed}
                    </p>
                    <p className="text-sm text-green-600">
                      Total cost: ${bucketResult.totalCost?.toFixed(4)}
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      Run ID: {bucketResult.runId}
                    </p>
                  </div>

                  {bucketResult.distribution && (
                    <div>
                      <h3 className="font-semibold mb-2">
                        Bucket Distribution
                      </h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Bucket</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Count</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">0</TableCell>
                            <TableCell>Bottom 25% (≤1 hour)</TableCell>
                            <TableCell className="text-right">
                              {bucketResult.distribution.bucket0}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">1</TableCell>
                            <TableCell>25-50% (1-4 hours)</TableCell>
                            <TableCell className="text-right">
                              {bucketResult.distribution.bucket1}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">2</TableCell>
                            <TableCell>50-75% (1 day - 1 week)</TableCell>
                            <TableCell className="text-right">
                              {bucketResult.distribution.bucket2}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">3</TableCell>
                            <TableCell>Top 25% (&gt;1 week)</TableCell>
                            <TableCell className="text-right">
                              {bucketResult.distribution.bucket3}
                            </TableCell>
                          </TableRow>
                          <TableRow className="font-semibold bg-muted/50">
                            <TableCell>Total</TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right">
                              {bucketResult.totalProcessed}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Test PR Triage Trigger</CardTitle>
          <CardDescription>
            Trigger the PR triage workflow for a specific repository
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="repository" className="text-sm font-medium">
              Repository (owner/repo)
            </label>
            <Input
              id="repository"
              type="text"
              placeholder="owner/repo"
              value={repository}
              onChange={(e) => setRepository(e.target.value)}
              disabled={loading}
            />
          </div>

          <Button
            onClick={handleTrigger}
            disabled={loading || !repository}
            className="w-full"
          >
            {loading ? "Triggering..." : "Trigger PR Triage"}
          </Button>

          {result && (
            <div className="space-y-4">
              {result.error ? (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                  <p className="font-semibold text-red-800">Error</p>
                  <p className="text-sm text-red-600">{result.error}</p>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                    <p className="font-semibold text-green-800">
                      ✅ {result.message}
                    </p>
                    <p className="text-sm text-green-600 mt-1">
                      Found {result.totalPRs} open pull requests
                    </p>
                  </div>

                  {result.prs && result.prs.length > 0 && (
                    <PRTriageTable
                      repository={repository}
                      prs={result.prs}
                      stats={result.stats}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
