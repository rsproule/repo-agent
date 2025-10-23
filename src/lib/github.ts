import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";
import { prisma } from "@/lib/db";

export function getEnv(name: string, required = true): string | undefined {
  const value = process.env[name];
  if (required && (!value || value.length === 0)) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function normalizePrivateKey(pem: string): string {
  // Support keys provided with escaped newlines
  if (pem.includes("\\n")) return pem.replace(/\\n/g, "\n");
  return pem;
}

export function getGitHubAppInstallUrl(): string {
  const slug = getEnv("GITHUB_APP_SLUG")!;
  return `https://github.com/apps/${slug}/installations/new`;
}

export async function getInstallationTokenForUser(
  echoUserId: string,
): Promise<string> {
  // Get user's GitHub installations from database
  const installation = await prisma.githubInstallation.findFirst({
    where: {
      echoUserId,
    },
  });

  if (!installation) {
    throw new Error(
      `No GitHub installation found for user ${echoUserId}. ` +
      `Please install the app at: ${getGitHubAppInstallUrl()}`
    );
  }

  // Create GitHub App Octokit instance
  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: getEnv("GITHUB_APP_ID")!,
      privateKey: normalizePrivateKey(getEnv("GITHUB_APP_PRIVATE_KEY")!),
    },
  });

  // Create installation access token
  const tokenResponse = await octokit.request(
    "POST /app/installations/{installation_id}/access_tokens",
    {
      installation_id: Number(installation.installationId),
    },
  );

  return tokenResponse.data.token;
}

export async function getInstallationTokenForRepo(
  owner: string,
  repo: string,
): Promise<string> {
  // This is the legacy function - we should migrate to getInstallationTokenForUser
  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: getEnv("GITHUB_APP_ID")!,
      privateKey: normalizePrivateKey(getEnv("GITHUB_APP_PRIVATE_KEY")!),
    },
  });

  try {
    const installation = await octokit.request(
      "GET /repos/{owner}/{repo}/installation",
      {
        owner,
        repo,
      },
    );

    const tokenResponse = await octokit.request(
      "POST /app/installations/{installation_id}/access_tokens",
      {
        installation_id: installation.data.id,
      },
    );

    return tokenResponse.data.token;
  } catch (_error: unknown) {
    throw new Error(
      `GitHub App is not installed on repository ${owner}/${repo}. ` +
      `Please install the app at: ${getGitHubAppInstallUrl()}`
    );
  }
}
