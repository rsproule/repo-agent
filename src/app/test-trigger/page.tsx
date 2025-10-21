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
