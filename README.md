# GitHub x Echo Connector

Powered by Echo for LLM generations with GitHub MCP server integration.

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Install Docker

The agent uses the official GitHub MCP server Docker image. Make sure you have Docker installed:

```bash
# macOS (with Homebrew)
brew install --cask docker

# Or download from: https://www.docker.com/products/docker-desktop
```

The GitHub MCP server Docker image will be pulled automatically on first use:
- Image: `ghcr.io/github/github-mcp-server`
- No manual build or binary management needed!

### 3. Run the Development Server

```bash
pnpm dev
```

## GitHub App Integration

Set the following environment variables for the GitHub App flow:
Create a [GitHub App](https://github.com/settings/apps/new).

```bash
GITHUB_APP_ID=123456
GITHUB_APP_SLUG=your-app-slug
# Private key in PKCS8 format. If multi-line, use \n escaped newlines.
GITHUB_APP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```