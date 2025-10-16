import { openai } from "@/echo";
import { streamText, tool } from "ai";
import { NextRequest } from "next/server";
import { z } from "zod";

export async function POST(request: NextRequest) {
  const { messages } = await request.json();

  if (!messages || !messages.length) {
    return new Response(JSON.stringify({ error: "Messages are required" }), {
      status: 400,
    });
  }

  const result = streamText({
    model: openai("gpt-4o"),
    tools: {
      weather: tool({
        description: "Get the weather in a location",
        inputSchema: z.object({
          location: z.string().describe("The location to get the weather for"),
        }),
        execute: async ({ location }) => ({
          location,
          temperature: 72 + Math.floor(Math.random() * 21) - 10,
        }),
      }),
    },
    prompt: "What is the weather in San Francisco?",
  });

  return result.toUIMessageStreamResponse();
}
