import { anthropic } from "@/echo";
import type { PRAnalysis, PRFile, PullRequest } from "@/types/github";
import { generateObject } from "ai";
import { z } from "zod";

const PRAnalysisSchema = z.object({
  summary: z.string().describe("A concise summary of what this PR does"),
  relevance: z
    .enum(["high", "medium", "low"])
    .describe("How relevant/important is this PR"),
  category: z
    .string()
    .describe(
      "Category: feature, bugfix, refactor, docs, tests, chore, security, performance",
    ),
  impact: z.object({
    scope: z
      .array(z.string())
      .describe("Areas of the codebase affected (e.g., auth, ui, api, db)"),
    risk: z
      .enum(["high", "medium", "low"])
      .describe("Risk level of these changes"),
  }),
  filesChanged: z.object({
    total: z.number(),
    additions: z.number(),
    deletions: z.number(),
    keyFiles: z
      .array(z.string())
      .describe("Most important files changed in this PR"),
  }),
  recommendations: z
    .array(z.string())
    .describe("Actionable recommendations for reviewing or handling this PR"),
  aiGenerated: z.object({
    probability: z
      .number()
      .min(0)
      .max(100)
      .describe(
        "Probability (0-100) that this PR was AI-generated based on code patterns, commit messages, and description style",
      ),
    confidence: z
      .enum(["high", "medium", "low"])
      .describe("Confidence level in the AI generation assessment"),
    reasoning: z
      .string()
      .describe(
        "Brief explanation of why this appears AI-generated or human-written",
      ),
  }),
});

/**
 * Analyze a pull request using AI
 */
export async function analyzePullRequest(
  pr: PullRequest,
  files: PRFile[],
  repoContext?: {
    owner: string;
    repo: string;
  },
): Promise<PRAnalysis> {
  // Calculate file stats
  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

  // Build a summary of file changes (limit patch size to avoid token limits)
  const filesSummary = files.map((file) => {
    const patchPreview = file.patch
      ? file.patch.slice(0, 500) + (file.patch.length > 500 ? "..." : "")
      : "";

    return `
File: ${file.filename}
Status: ${file.status}
Changes: +${file.additions} -${file.deletions}
${patchPreview ? `Patch preview:\n${patchPreview}` : ""}
`.trim();
  });

  const prompt = `Analyze this pull request and provide a structured assessment.

## Pull Request Details
Title: ${pr.title}
Author: ${pr.user.login}
${
  pr.body
    ? `Description:\n${pr.body.slice(0, 1000)}`
    : "No description provided"
}
${repoContext ? `Repository: ${repoContext.owner}/${repoContext.repo}` : ""}

## Files Changed (${files.length} files)
Total additions: +${totalAdditions}
Total deletions: -${totalDeletions}

${filesSummary.slice(0, 10).join("\n\n")}
${files.length > 10 ? `\n... and ${files.length - 10} more files` : ""}

Provide a comprehensive analysis including ALL required fields:

1. **Summary**: Concise description of what the PR does
2. **Relevance**: How important is this PR (high/medium/low)
3. **Category**: Type of change (feature/bugfix/refactor/docs/tests/chore/security/performance)
4. **Impact**: Scope of affected areas and risk level
5. **Files Changed**: Statistics and key files
6. **Recommendations**: Actionable review suggestions
7. **AI Generation Probability** (REQUIRED): Analyze the code patterns, commit style, PR description, and overall characteristics to estimate the probability (0-100) this PR was AI-generated. Consider:
   - Overly verbose or formal commit messages
   - Perfect formatting and documentation
   - Patterns typical of LLM-generated code
   - Lack of human quirks or shortcuts
   - Generic variable names or excessive comments
   - Unusually complete test coverage or edge case handling
   
Provide your confidence level (high/medium/low) and reasoning for the AI generation assessment.`;

  const result = await generateObject({
    model: anthropic("claude-3-5-sonnet-20241022"),
    schema: PRAnalysisSchema,
    prompt,
  });

  const analysis = result.object as PRAnalysis;

  // Ensure aiGenerated field exists (fallback if AI doesn't generate it)
  if (!analysis.aiGenerated) {
    analysis.aiGenerated = {
      probability: 50,
      confidence: "low",
      reasoning:
        "Unable to assess AI generation probability - insufficient data",
    };
  }

  return analysis;
}
