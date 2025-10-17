import { experimental_createMCPClient } from "ai";
import { Experimental_StdioMCPTransport } from "ai/mcp-stdio";

/**
 * Creates a GitHub MCP client with user-specific authentication.
 * Uses Docker to run the official GitHub MCP server image.
 *
 * @param token - GitHub Personal Access Token or GitHub App Installation Token
 * @returns MCP client instance
 */
export async function createGitHubMCPClient(token: string) {
  try {
    const transport = new Experimental_StdioMCPTransport({
      command: "docker",
      args: [
        "run",
        "-i",
        "--rm",
        "-e",
        "GITHUB_PERSONAL_ACCESS_TOKEN",
        "ghcr.io/github/github-mcp-server",
      ],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: token,
      },
    });

    const githubMcp = await experimental_createMCPClient({
      transport,
    });

    return githubMcp;
  } catch (error) {
    console.error("Error initializing Github MCP:", error);
    throw error;
  }
}
