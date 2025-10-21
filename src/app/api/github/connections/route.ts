import { getUser } from "@/echo";
import { prisma } from "@/lib/db";
import { normalizePrivateKey } from "@/lib/github";
import { createAppAuth } from "@octokit/auth-app";
import { NextResponse } from "next/server";
import { Octokit } from "octokit";

type RepoMeta = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch: string;
  owner: { login: string; id: number; html_url: string };
};

type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch: string;
  owner: { login: string; id: number; html_url: string };
};

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch installations from Prisma
    const installs = await prisma.githubInstallation.findMany({
      where: {
        echoUserId: user.id,
      },
      select: {
        installationId: true,
        accountLogin: true,
        accountId: true,
      },
    });

    if (!installs || installs.length === 0) {
      return NextResponse.json({ connections: [] });
    }

    const connections: Array<{
      installation_id: number;
      account_login?: string | null;
      account_id?: number | null;
      repositories: RepoMeta[];
    }> = [];

    for (const inst of installs) {
      try {
        const octokit = new Octokit({
          authStrategy: createAppAuth,
          auth: {
            appId: process.env.GITHUB_APP_ID!,
            privateKey: normalizePrivateKey(
              process.env.GITHUB_APP_PRIVATE_KEY!,
            ),
            installationId: Number(inst.installationId),
          },
        });

        // List repositories accessible to the installation
        const repos: RepoMeta[] = [];
        let page = 1;

        while (true) {
          const { data } = await octokit.request(
            "GET /installation/repositories",
            {
              per_page: 100,
              page,
            },
          );

          for (const r of data.repositories as GitHubRepo[]) {
            repos.push({
              id: r.id,
              name: r.name,
              full_name: r.full_name,
              private: r.private,
              html_url: r.html_url,
              default_branch: r.default_branch,
              owner: {
                login: r.owner?.login,
                id: r.owner?.id,
                html_url: r.owner?.html_url,
              },
            });
          }

          if (data.repositories.length < 100) break;
          page += 1;
        }

        connections.push({
          installation_id: Number(inst.installationId),
          account_login: inst.accountLogin ?? null,
          account_id: inst.accountId ? Number(inst.accountId) : null,
          repositories: repos,
        });
      } catch (error) {
        console.error(
          `Failed to fetch repos for installation ${inst.installationId}:`,
          error,
        );
        // Continue with other installations even if one fails
      }
    }

    return NextResponse.json({ connections });
  } catch (error) {
    console.error("GitHub connections error:", error);
    return NextResponse.json(
      { error: "Failed to fetch GitHub connections" },
      { status: 500 },
    );
  }
}
