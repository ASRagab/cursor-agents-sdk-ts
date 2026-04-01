# cursor-agents

TypeScript SDK and CLI for the [Cursor Cloud Agents API](https://api.cursor.com).

Create, manage, and monitor AI coding agents that work autonomously on your GitHub repositories.

## Installation

```bash
bun add cursor-agents
```

Or clone and use directly:

```bash
git clone https://github.com/ASRagab/cursor-agents-sdk-ts.git
cd cursor-agents-sdk-ts
bun install
```

## Authentication

Get an API key from the [Cursor Dashboard](https://cursor.com/dashboard).

```bash
export CURSOR_API_KEY="your-key-here"
```

## SDK Usage

```typescript
import { CursorAgents } from "cursor-agents";

const client = new CursorAgents();
// Or: new CursorAgents({ apiKey: "cur_..." })

// Create an agent
const agent = await client.agents.create({
  prompt: { text: "Fix the failing tests in src/utils.ts" },
  source: { repository: "https://github.com/owner/repo", ref: "main" },
  model: "claude-4-sonnet-thinking",
  target: { autoCreatePr: true },
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
  --repo https://github.com/owner/repo \
  --ref main \
  --prompt "Fix the failing tests" \
  --model claude-4-sonnet-thinking \
  --auto-pr

# Create from a PR
cursor-agents create \
  --pr https://github.com/owner/repo/pull/42 \
  --prompt "Review and fix the issues"

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

## SDK API Reference

### `CursorAgents(opts?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | `CURSOR_API_KEY` env | API key |
| `baseUrl` | `string` | `https://api.cursor.com` | API base URL |

### Agent Methods

| Method | Description |
|--------|-------------|
| `agents.create(opts)` | Launch an agent |
| `agents.list(opts?)` | List agents (paginated) |
| `agents.get(id)` | Get agent status |
| `agents.delete(id)` | Delete agent |
| `agents.stop(id)` | Stop running agent |
| `agents.followup(id, opts)` | Send followup instruction |
| `agents.conversation(id)` | Get conversation history |
| `agents.waitFor(id, opts?)` | Poll until terminal state |
| `agents.watch(id, opts?)` | Tail conversation messages |

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
bun run build        # Build for Node
```

## License

MIT
