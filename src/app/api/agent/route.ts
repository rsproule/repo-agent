import { getUser, openai } from "@/echo";
import { createGitHubMCPClient } from "@/lib/github-mcp-client";
import { getGitHubInstallationToken } from "@/lib/github-token-provider";
import { convertToModelMessages, streamText } from "ai";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const { messages } = await request.json();

  if (!messages || !messages.length) {
    return new Response(JSON.stringify({ error: "Messages are required" }), {
      status: 400,
    });
  }

  let mcpClient: Awaited<ReturnType<typeof createGitHubMCPClient>> | undefined;

  try {
    // Get authenticated Echo user
    const user = await getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    // Get fresh GitHub App installation token for this user
    const githubToken = await getGitHubInstallationToken(user.id);
    mcpClient = await createGitHubMCPClient(githubToken);
    const githubTools = await mcpClient.tools({ schemas: "automatic" });

    console.log(`Loaded ${Object.keys(githubTools).length} GitHub tools`);

    const modelMessages = convertToModelMessages(messages);
    const result = streamText({
      model: openai("gpt-4o"),
      tools: githubTools,
      messages: modelMessages,
      system: `You are a helpful GitHub assistant with access to GitHub tools. 
When users ask about repositories, issues, pull requests, or any GitHub data, you MUST use the available GitHub tools to fetch real-time information.
Always prefer using tools over your training data for GitHub-related queries.`,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Agent error:", error);

    // Close MCP client on error
    if (mcpClient) {
      console.log("Closing MCP client on error");
      await mcpClient.close();
    }

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
