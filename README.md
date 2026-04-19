# cursor-agents

TypeScript SDK and CLI for the [Cursor Cloud Agents API](https://api.cursor.com).

Create, manage, and monitor AI coding agents that work autonomously on your GitHub repositories.

## Installation

Install from npm:

```bash
npm install -g @twelvehart/cursor-agents
bun add @twelvehart/cursor-agents
```

The package installs the `cursor-agents` CLI binary:

```bash
npx @twelvehart/cursor-agents --help
cursor-agents --help
```

### CLI Packaging

The published package ships a Node entrypoint at `bin/cursor-agents.js` that loads the built CLI bundle from `dist/cli/index.js`. That keeps `cursor-agents` self-contained for global installs, `npx`, and `bunx` without requiring users to execute the TypeScript source directly.

Or clone and use directly:

```bash
git clone https://github.com/ASRagab/cursor-agents-sdk-ts.git
cd cursor-agents-sdk-ts
bun install
node bin/cursor-agents.js --help
```

## Authentication

Get an API key from the [Cursor Dashboard](https://cursor.com/dashboard).

```bash
export CURSOR_API_KEY="your-key-here"
```

The SDK and CLI also read `CURSOR_API_KEY` and `CURSOR_BASE_URL` from a local `.env` file in the current working directory:

```dotenv
CURSOR_API_KEY=your-key-here
CURSOR_BASE_URL=https://api.cursor.com
```

## SDK Usage

```typescript
import { CursorAgents } from "@twelvehart/cursor-agents";

const client = new CursorAgents();
// Or: new CursorAgents({ apiKey: "cur_..." })

// Create an agent
const agent = await client.agents.create({
  prompt: { text: "Fix the failing tests in src/utils.ts" },
  source: { repository: "https://github.com/owner/repo", ref: "main" },
  // Run `cursor-agents models` to list valid model IDs
  model: "<model-id>",
  target: { autoCreatePr: true },
  // Optional: receive status-change notifications via webhook.
  // If `secret` is provided, it must be at least 32 characters.
  webhook: {
    url: "https://example.com/cursor-agents-hook",
    secret: process.env.CURSOR_WEBHOOK_SECRET,
  },
});

// Wait for completion
const result = await client.agents.waitFor(agent.id, {
  onStatus: (a) => console.log(`Status: ${a.status}`),
});

// Watch conversation in real-time
const final = await client.agents.watch(agent.id, {
  onMessage: (msg) => console.log(`[${msg.type}] ${msg.text}`),
});

// Get conversation history
const convo = await client.agents.conversation(agent.id);

// List and download artifacts
const artifacts = await client.agents.artifacts.list(agent.id);
const download = await client.agents.artifacts.downloadUrl(
  agent.id,
  artifacts.artifacts[0].absolutePath,
);

// Metadata
const me = await client.me();
const models = await client.models();
const repos = await client.repositories();
```

## Publishing

This repository is set up to publish `@twelvehart/cursor-agents` with `release-please`. Commits merged to `main` update or create a release PR, and merging that PR triggers a GitHub release plus npm publish after lint, typecheck, unit tests, build, CLI smoke test, and `npm pack --dry-run`.

To make the workflow actually publish on npm, configure npm trusted publishing for the `@twelvehart/cursor-agents` package and point it at `.github/workflows/release-please.yml`. npm's current docs recommend trusted publishing with GitHub-hosted runners and `id-token: write` instead of long-lived `NPM_TOKEN` secrets.

## CLI Usage

### Global Flags

| Flag | Env Var | Description |
|------|---------|-------------|
| `--json` | — | Output structured JSON |
| `--api-key <key>` | `CURSOR_API_KEY` | API key |
| `--base-url <url>` | `CURSOR_BASE_URL` | Override API base URL |
| `--quiet` | — | Suppress non-essential output |

### Commands

```bash
# Authentication
cursor-agents auth whoami

# List available models and repos
cursor-agents models
cursor-agents repos

# Create an agent
cursor-agents create \
  --repo owner/repo \
  --ref main \
  --prompt "Fix the failing tests" \
  # Run `cursor-agents models` to list valid model IDs
  --model <model-id> \
  --auto-pr

# Full GitHub URLs also work
cursor-agents create \
  --repo https://github.com/owner/repo \
  --ref main \
  --prompt "Fix the failing tests"

# Create from a PR
cursor-agents create \
  --pr https://github.com/owner/repo/pull/42 \
  --prompt "Review and fix the issues"

# --auto-branch is only valid with --pr
cursor-agents create \
  --pr https://github.com/owner/repo/pull/42 \
  --prompt "Address review feedback" \
  --auto-branch

# Use a prompt file for long prompts
cursor-agents create \
  --repo https://github.com/owner/repo \
  --prompt-file ./task.md

# Include images
cursor-agents create \
  --repo https://github.com/owner/repo \
  --prompt "Fix the layout shown in this screenshot" \
  --image ./screenshot.png

# Create and wait for completion
cursor-agents create \
  --repo https://github.com/owner/repo \
  --prompt "Add error handling" \
  --wait

# Create and watch conversation
cursor-agents create \
  --repo https://github.com/owner/repo \
  --prompt "Refactor the auth module" \
  --watch

# List agents
cursor-agents list
cursor-agents list --limit 50 --pr https://github.com/owner/repo/pull/1

# Get agent status
cursor-agents status <agent-id>

# Wait for an agent
cursor-agents wait <agent-id> --timeout 300000

# Watch conversation messages
cursor-agents watch <agent-id>

# Send followup instruction
cursor-agents followup <agent-id> --prompt "Also update the README"
cursor-agents followup <agent-id> --prompt-file ./followup.md

# Stop / delete
cursor-agents stop <agent-id>
cursor-agents delete <agent-id>

# View conversation
cursor-agents conversation <agent-id>

# List and download artifacts
cursor-agents artifacts <agent-id>
cursor-agents download <agent-id> /workspace/src/index.ts --output ./index.ts
```

### JSON Output

When `--json` is passed, all output is structured:

```json
{ "ok": true, "data": { "id": "agent_123", "status": "FINISHED" } }
```

On error:

```json
{ "ok": false, "error": { "code": "not_found", "message": "Agent not found", "status": 404 } }
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Auth error |
| 3 | Not found |
| 4 | Rate limited |
| 5 | Timeout |

### Coding Agent Skill

The repository includes an agent skill at [`skills/cursor-agents-cli/SKILL.md`](skills/cursor-agents-cli/SKILL.md).
This file teaches agents like Claude Code, Codex, Cursor, and others how to operate the CLI:
flag rules, workflow recipes, error recovery, and the JSON output contract.

Install via the [`npx skills`](https://github.com/vercel-labs/skills) ecosystem:

```bash
# Install to all detected agents
npx skills add ASRagab/cursor-agents-sdk-ts

# Install to a specific agent
npx skills add ASRagab/cursor-agents-sdk-ts -a claude-code

# Install to a specific agent globally
npx skills add ASRagab/cursor-agents-sdk-ts -a claude-code -g

# List available skills first
npx skills add ASRagab/cursor-agents-sdk-ts --list
```

Or copy the file manually into your agent's skills directory (e.g., `.claude/skills/` for Claude Code).

## SDK API Reference

### `CursorAgents(opts?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | `CURSOR_API_KEY` env | API key |
| `baseUrl` | `string` | `https://api.cursor.com` | API base URL |

### Agent Methods

| Method | Description |
|--------|-------------|
| `agents.create(opts)` | Launch an agent. `opts` accepts `prompt`, `source`, `model`, `target`, and optional `webhook`. |
| `agents.list(opts?)` | List agents (paginated) |
| `agents.get(id)` | Get agent status |
| `agents.delete(id)` | Delete agent (permanent) |
| `agents.stop(id)` | Pause a running agent. Sending a `followup` resumes it. |
| `agents.followup(id, opts)` | Send followup instruction (also resumes a stopped agent) |
| `agents.conversation(id)` | Get conversation history |
| `agents.waitFor(id, opts?)` | Poll until terminal state |
| `agents.watch(id, opts?)` | Tail conversation messages |

`CreateAgentOpts.webhook` is `{ url: string; secret?: string }` where `secret` must be at least 32 characters if provided.

### Artifact Methods

| Method | Description |
|--------|-------------|
| `agents.artifacts.list(agentId)` | List artifacts |
| `agents.artifacts.downloadUrl(agentId, path)` | Get presigned download URL |

### Metadata Methods

| Method | Description |
|--------|-------------|
| `me()` | API key info |
| `models()` | Available models |
| `repositories()` | Accessible GitHub repos |

## Development

```bash
bun install
bun run typecheck    # TypeScript type checking
bun run lint         # Biome linter
bun test             # Unit tests
bun test tests/integration  # Integration tests (needs CURSOR_API_KEY)
bun run build        # Build the SDK, CLI bundle, and type declarations
npm pack --dry-run   # Verify published package contents
```

## License

MIT
