#!/bin/bash
# Watch GitHub MCP Docker container logs in real-time

echo "🔍 Watching for GitHub MCP Docker containers..."
echo "Press Ctrl+C to stop"
echo ""

# Follow logs from all MCP containers
docker ps --filter ancestor=ghcr.io/github/github-mcp-server --format "{{.ID}}" | while read container_id; do
  echo "📦 Tailing logs for container: $container_id"
  docker logs -f $container_id &
done

wait

