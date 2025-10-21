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

  return (
    <div className="container mx-auto py-10 max-w-[95vw]">
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
