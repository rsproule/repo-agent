import { createArtifact } from "@ai-sdk-tools/artifacts";
import { z } from "zod";

export const mathArtifact = createArtifact({
  name: "math-solution",
  description: "Mathematical problem solution with steps",
  schema: z.object({
    problem: z.string(),
    solution: z.number(),
    steps: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  }),
});

export const historyArtifact = createArtifact({
  name: "history-analysis",
  description: "Historical event analysis",
  schema: z.object({
    event: z.string(),
    date: z.string(),
    significance: z.string(),
    keyFigures: z.array(z.string()),
    impact: z.string(),
  }),
});
