#!/usr/bin/env tsx

/**
 * Test script for PR sync functionality
 * Usage: pnpm test:sync-prs [owner] [repo] [echoUserId]
 * Example: pnpm test:sync-prs octocat Hello-World user123
 */

import "dotenv/config";
import { syncRepoPRs } from "./src/ai/tools/sync-prs";
import { defaultLogger } from "./src/lib/logger";

// Parse command line arguments
const args = process.argv.slice(2);
const owner = args[0] || "octocat";
const repo = args[1] || "Hello-World";
const echoUserId = args[2] || "test-user-id";

console.log("🚀 Testing PR Sync");
console.log("==================");
console.log(`Repository: ${owner}/${repo}`);
console.log(`Echo User ID: ${echoUserId}`);
console.log("");

async function test() {
  console.log("⏳ Starting sync...\n");

  const startTime = Date.now();

  const result = await syncRepoPRs(
    {
      owner,
      repo,
      echoUserId,
      pageSize: 100,
      requestDelayMs: 0,
    },
    defaultLogger,
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  if (result.isErr()) {
    console.error("\n❌ Sync failed!");
    console.error("==================");
    console.error(`Error Type: ${result.error.type}`);
    console.error(`Error Message: ${result.error.cause.message}`);
    if (result.error.cause.stack) {
      console.error("\nStack trace:");
      console.error(result.error.cause.stack);
    }
    process.exit(1);
  }

  const data = result.value;

  console.log("\n✅ Sync completed successfully!");
  console.log("==================");
  console.log(`Total PRs synced: ${data.totalSynced}`);
  console.log(`Duration: ${duration}s`);

  if (data.latestPR) {
    console.log("\nLatest PR:");
    console.log(`  #${data.latestPR.number} - ${data.latestPR.title}`);
    console.log(`  State: ${data.latestPR.state}`);
    console.log(`  Author: ${data.latestPR.user?.login || "unknown"}`);
    console.log(`  URL: ${data.latestPR.html_url}`);
  }

  process.exit(0);
}

test();
