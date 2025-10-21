import type { PRFile, PullRequest } from "@/types/github";
import { Octokit } from "@octokit/core";
import { ResultAsync } from "neverthrow";

/**
 * Get all pull requests for a specific repository with automatic pagination
 */
export function getRepositoryPullRequests(
  octokit: Octokit,
  owner: string,
  repo: string,
  state: "open" | "closed" | "all" = "open",
): ResultAsync<PullRequest[], Error> {
  return ResultAsync.fromPromise(
    (async () => {
      const allPRs: PullRequest[] = [];
      let page = 1;
      const perPage = 100;
      let hasMore = true;

      while (hasMore) {
        const { data } = await octokit.request(
          "GET /repos/{owner}/{repo}/pulls",
          {
            owner,
            repo,
            state,
            per_page: perPage,
            page,
          },
        );

        allPRs.push(...(data as PullRequest[]));

        // If we got fewer results than perPage, we've reached the last page
        hasMore = data.length === perPage;
        page++;
      }

      return allPRs;
    })(),
    (error) =>
      new Error(
        `Failed to fetch pull requests for ${owner}/${repo}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
  );
}

/**
 * Get files changed in a pull request
 */
export function getPullRequestFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
): ResultAsync<PRFile[], Error> {
  return ResultAsync.fromPromise(
    (async () => {
      const { data } = await octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
        {
          owner,
          repo,
          pull_number: pullNumber,
          per_page: 100,
        },
      );

      return data as PRFile[];
    })(),
    (error) =>
      new Error(
        `Failed to fetch files for PR #${pullNumber}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
  );
}
