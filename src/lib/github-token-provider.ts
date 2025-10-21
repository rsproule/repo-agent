import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";
import { prisma } from "./db";
import { getEnv, normalizePrivateKey } from "./github";

/**
 * Gets a fresh GitHub App installation token for the authenticated user.
 * Tokens are valid for 1 hour.
 *
 * @param echoUserId - The Echo user ID
 * @returns GitHub installation access token
 * @throws Error if user has no GitHub installations
 */
export async function getGitHubInstallationToken(
  echoUserId: string,
): Promise<string> {
  // Query the database for user's GitHub installations
  const installation = await prisma.githubInstallation.findFirst({
    where: {
      echoUserId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!installation) {
    throw new Error(
      "No GitHub installation found. Please install the GitHub App first.",
    );
  }

  // Create Octokit instance with App authentication
  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: getEnv("GITHUB_APP_ID")!,
      privateKey: normalizePrivateKey(getEnv("GITHUB_APP_PRIVATE_KEY")!),
    },
  });

  // Generate a fresh installation access token
  const tokenResponse = await octokit.request(
    "POST /app/installations/{installation_id}/access_tokens",
    {
      installation_id: Number(installation.installationId),
    },
  );

  return tokenResponse.data.token;
}
