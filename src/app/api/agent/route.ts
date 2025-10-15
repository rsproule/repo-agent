"use server";

import { openai } from "@/echo";
import { Agent } from "@ai-sdk-tools/agents";
import { InMemoryProvider } from "@ai-sdk-tools/memory";
import { NextRequest } from "next/server";

// Create a shared memory provider instance
const memoryProvider = new InMemoryProvider();

const mathAgent = new Agent({
  name: "Math Tutor",
  model: openai("gpt-4o"),
  instructions: `Help with math problems. Return structured solutions with steps.
    When solving problems:
    1. Break down the problem into steps
    2. Show your work clearly
    3. Provide the final answer
    4. Include explanations for each step`,
  matchOn: ["math", "calculate", /\d+/],
  memory: {
    provider: memoryProvider,
    workingMemory: { enabled: true, scope: "user" },
    history: { enabled: true, limit: 10 },
  },
});

const historyAgent = new Agent({
  name: "History Tutor",
  model: openai("gpt-4o"),
  instructions: `Help with history questions. Provide detailed historical analysis.
    For each historical topic:
    1. Provide context and background
    2. Identify key figures and events
    3. Explain historical significance
    4. Discuss long-term impact`,
  matchOn: ["history", "war"],
  memory: {
    provider: memoryProvider,
    workingMemory: { enabled: true, scope: "user" },
    history: { enabled: true, limit: 10 },
  },
});

const orchestrator = new Agent({
  name: "Triage",
  model: openai("gpt-4o-mini"),
  instructions: "Route to specialists based on query content",
  handoffs: [mathAgent, historyAgent],
  memory: {
    provider: memoryProvider,
    workingMemory: { enabled: true, scope: "user" },
    history: { enabled: true, limit: 10 },
  },
});

export async function POST(request: NextRequest) {
  const { messages } = await request.json();

  if (!messages || !messages.length) {
    return new Response(JSON.stringify({ error: "Messages are required" }), {
      status: 400,
    });
  }

  // Convert UI messages to model messages

  return orchestrator.toUIMessageStream({
    messages,
  });
}
