"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PRAnalysisData {
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
}

interface PRData {
  number: number;
  title: string;
  author: string;
  state: string;
  url: string;
  created_at: string;
  filesChanged: number;
  analysis?: PRAnalysisData | null;
}

interface PRTriageTableProps {
  repository: string;
  prs: PRData[];
  stats?: {
    analyzed: number;
    skipped: number;
    failed: number;
  };
}

function getRelevanceBadge(relevance: "high" | "medium" | "low") {
  const variants: Record<string, "destructive" | "default" | "secondary"> = {
    high: "destructive",
    medium: "default",
    low: "secondary",
  };

  return (
    <Badge variant={variants[relevance]} className="capitalize">
      {relevance}
    </Badge>
  );
}

function getRiskBadge(risk: "high" | "medium" | "low") {
  const variants: Record<string, "destructive" | "default" | "secondary"> = {
    high: "destructive",
    medium: "default",
    low: "secondary",
  };

  return (
    <Badge variant={variants[risk]} className="capitalize">
      {risk}
    </Badge>
  );
}

export function PRTriageTable({ repository, prs, stats }: PRTriageTableProps) {
  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">PR Triage: {repository}</h3>
          <p className="text-sm text-muted-foreground">
            {prs.length} pull requests
          </p>
        </div>
        {stats && (
          <div className="flex gap-4 text-sm">
            <span className="text-green-600">✓ {stats.analyzed} analyzed</span>
            <span className="text-blue-600">⊙ {stats.skipped} skipped</span>
            {stats.failed > 0 && (
              <span className="text-red-600">✗ {stats.failed} failed</span>
            )}
          </div>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">PR #</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Relevance</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead>AI Gen %</TableHead>
              <TableHead className="text-right">Files</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground"
                >
                  No pull requests found
                </TableCell>
              </TableRow>
            ) : (
              prs.map((pr) => (
                <TableRow
                  key={pr.number}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => window.open(pr.url, "_blank")}
                >
                  <TableCell className="font-medium">#{pr.number}</TableCell>
                  <TableCell className="max-w-[400px]">
                    <div className="truncate" title={pr.title}>
                      {pr.title}
                    </div>
                    {pr.analysis && (
                      <div className="text-xs text-muted-foreground truncate mt-1">
                        {pr.analysis.summary}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{pr.author}</span>
                  </TableCell>
                  <TableCell>
                    {pr.analysis ? (
                      <Badge variant="outline" className="capitalize">
                        {pr.analysis.category}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {pr.analysis ? (
                      getRelevanceBadge(pr.analysis.relevance)
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {pr.analysis?.impact ? (
                      getRiskBadge(pr.analysis.impact.risk)
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {pr.analysis?.aiGenerated ? (
                      <div
                        className="flex items-center gap-1"
                        title={pr.analysis.aiGenerated.reasoning}
                      >
                        <span
                          className={`text-sm font-medium ${
                            pr.analysis.aiGenerated.probability >= 70
                              ? "text-orange-600"
                              : pr.analysis.aiGenerated.probability >= 40
                              ? "text-yellow-600"
                              : "text-green-600"
                          }`}
                        >
                          {pr.analysis.aiGenerated.probability}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm tabular-nums">
                      {pr.filesChanged}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {prs.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Click on any row to open the PR in GitHub
        </div>
      )}
    </div>
  );
}
