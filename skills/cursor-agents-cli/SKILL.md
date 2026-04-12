---
name: cursor-agents-cli
description: Operate the cursor-agents CLI to launch, monitor, and manage Cursor Cloud Agents on GitHub repositories. Use this skill when asked to create coding agents, address PR review comments, run background coding tasks, retrieve agent artifacts, or automate any workflow involving the Cursor Agents API. Provides flag rules, workflow recipes, error recovery, and JSON output contracts.
license: MIT
metadata:
  author: ASRagab
  version: "0.2.0"
---

# Cursor Agents CLI -- Coding Agent Skill

## Purpose

This skill enables you (a coding agent) to operate the `cursor-agents` CLI on behalf of a user.
You translate user intent -- "fix the tests," "address PR review comments," "refactor the auth module" --
into CLI commands that create, monitor, follow up on, and complete Cursor Cloud Agent tasks.

**Always pass `--json` on every command.** This gives you structured, machine-parseable output.

## Prerequisites

| Requirement | Details |
|-------------|---------|
| API key | `CURSOR_API_KEY` must be set in the shell environment or a `.env` file in the working directory. |
| CLI binary | Invoke as `cursor-agents` (global install), `npx cursor-agents`, or `bunx cursor-agents`. |
| Verify auth | Before any operation, run `cursor-agents auth whoami --json` to confirm credentials. |

## How Cursor Cloud Agents Work

Cursor Cloud Agents are **remote, sandboxed AI coding agents** that operate on GitHub repositories.

- A user submits a **prompt** and a **source** (repository + branch, or an existing PR URL).
- The Cursor platform provisions a **Remote Execution Node (REN)** -- a sandboxed cloud environment that clones the target repo into `/workspace/`.
- The agent reads the codebase, executes the prompt, and optionally creates a PR or pushes commits.
- All file modifications happen server-side inside the REN. The agent has **no access** to the caller's local filesystem.
- Artifacts produced by the agent (modified files, new files) are referenced by their `/workspace/...` paths and can be listed or downloaded via the CLI.

### Agent Lifecycle States

| Status | Meaning | Terminal? |
|--------|---------|-----------|
| `CREATING` | Agent is being provisioned | No |
| `RUNNING` | Agent is actively working | No |
| `FINISHED` | Agent completed successfully | **Yes** |
| `ERROR` | Agent encountered a fatal error | **Yes** |
| `EXPIRED` | Agent timed out server-side | **Yes** |

Polling and watching stop automatically when a terminal state is reached.

## Global Flags

Pass these on every invocation:

| Flag | Description |
|------|-------------|
| `--json` | **Required for agents.** Outputs structured JSON envelopes. |
| `--api-key <key>` | Override the `CURSOR_API_KEY` environment variable. |
| `--base-url <url>` | Override the API base URL (default: `https://api.cursor.com`). |
| `--quiet` | Suppress non-essential stderr status lines during `--wait`/`--watch`. |

## JSON Output Contract

### Success

```json
{ "ok": true, "data": { "id": "agent_abc", "status": "FINISHED", ... } }
```

### Error

```json
{
  "ok": false,
  "error": {
    "code": "bad_request",
    "message": "--watch and --wait are mutually exclusive.",
    "status": 400,
    "hint": "--watch streams conversation messages in real-time. --wait only reports the final agent status.",
    "nextStep": "Choose one: --watch for conversation output, or --wait for status-only polling."
  }
}
```

**Key behavior**: In `--json` mode, both success and error output go to **stdout**.
Status updates during `--wait`/`--watch` go to **stderr** (suppressed by `--quiet`).

Always parse stdout and check the `ok` field first.

### `--watch --json` Streaming

When using `--watch --json`, stdout contains **multiple JSON lines** -- one per conversation message,
then a final `{ "ok": true, "data": <agent> }` line. Parse line-by-line, not as a single JSON object.

Each conversation message line:
```json
{ "id": "msg_1", "type": "user_message", "text": "Fix the tests" }
{ "id": "msg_2", "type": "assistant_message", "text": "I'll start by examining..." }
```

## Command Reference

### Authentication and Discovery

```bash
# Verify credentials
cursor-agents auth whoami --json

# List available models (cache for the session)
cursor-agents models --json

# List accessible repositories
cursor-agents repos --json
```

### Create an Agent

```bash
cursor-agents create \
  --repo <owner/repo | github-url> \
  --ref <branch> \
  --prompt <text> \
  [--prompt-file <path>] \
  [--model <id>] \
  [--auto-pr] \
  [--branch-name <name>] \
  [--as-app] \
  [--image <path...>] \
  [--wait] [--watch] \
  --json
```

Or from a pull request:

```bash
cursor-agents create \
  --pr <pull-request-url> \
  --prompt <text> \
  [--auto-branch] \
  [--branch-name <name>] \
  [--wait] [--watch] \
  --json
```

### Agent Lifecycle Commands

```bash
# List agents (optionally filtered by PR)
cursor-agents list [--limit <n>] [--cursor <token>] [--pr <url>] --json

# Get current status
cursor-agents status <agent-id> --json

# Poll until terminal state
cursor-agents wait <agent-id> [--interval <ms>] [--timeout <ms>] --json

# Stream conversation messages until terminal state
cursor-agents watch <agent-id> [--interval <ms>] --json

# Send follow-up instruction
cursor-agents followup <agent-id> --prompt <text> [--prompt-file <path>] [--image <path...>] --json

# Stop a running agent (pauses execution; a followup prompt resumes it)
cursor-agents stop <agent-id> --json

# Delete an agent permanently
cursor-agents delete <agent-id> --json

# View full conversation history
cursor-agents conversation <agent-id> --json
```

### Artifacts

```bash
# List artifacts produced by the agent
cursor-agents artifacts <agent-id> --json

# Download an artifact to a local file
cursor-agents download <agent-id> <artifact-path> [--output <local-path>] --json
```

## Flag Rules (Create Command)

The CLI validates all flag combinations and returns structured errors with `hint` and `nextStep` fields.
To avoid round-tripping on errors, follow these rules:

### Source Mode -- pick exactly one

| Mode | Flags | Use when |
|------|-------|----------|
| Repository | `--repo <owner/repo>` + optional `--ref <branch>` | Starting fresh from a branch |
| Pull request | `--pr <url>` | Responding to an existing PR |

Do **not** combine `--ref` with `--pr` -- the PR already defines the source branch.

### Prompt Mode -- pick exactly one

| Mode | Flag | Use when |
|------|------|----------|
| Inline | `--prompt <text>` | Short prompts |
| File | `--prompt-file <path>` | Long or multiline prompts |

Do **not** provide both.

### Monitor Mode -- pick at most one

| Mode | Flag | What you get |
|------|------|-------------|
| Wait | `--wait` | Polls until terminal state; prints final agent status |
| Watch | `--watch` | Streams conversation messages until terminal state |
| Neither | _(omit both)_ | Fire-and-forget; poll manually with `status`/`wait`/`watch` later |

Do **not** combine `--wait` with `--watch`.

### Target Flags

| Flag | Valid with | Cannot combine with | Purpose |
|------|-----------|-------------------|---------|
| `--auto-pr` | `--repo` only | `--pr` | Creates a new PR when the agent finishes |
| `--auto-branch` | `--pr` only | `--repo`, `--branch-name` | Lets Cursor auto-select a follow-up branch |
| `--branch-name <name>` | Either source | `--auto-branch` | Sets an explicit branch name |

### Model Selection

- Run `cursor-agents models --json` to discover valid model IDs. Cache the list for the session.
- If the user specifies a model family (e.g., "use Claude"), fuzzy-match against the list.
- If no model is specified, omit `--model` to use the platform default.

### Repository Format

`--repo` accepts: `owner/repo`, `https://github.com/owner/repo`, `git@github.com:owner/repo`.
All normalize to HTTPS automatically.

## Workflow Recipes

### A. Launch agent on a repo, auto-create PR, wait for completion

```bash
cursor-agents create \
  --repo owner/repo --ref main \
  --prompt "Fix the failing tests in src/utils.ts" \
  --model claude-4-sonnet-thinking \
  --auto-pr --wait --json
```

Parse the final line. Confirm `data.status` is `"FINISHED"`.

### B. Address PR review comments

```bash
cursor-agents create \
  --pr https://github.com/owner/repo/pull/42 \
  --prompt "Address all review comments" \
  --auto-branch --wait --json
```

### C. Fire-and-forget with manual polling

```bash
# 1. Create
cursor-agents create --repo owner/repo --ref main --prompt "Refactor auth module" --json
# 2. Extract data.id from the output
# 3. Poll periodically:
cursor-agents status <agent-id> --json
# 4. When data.status is FINISHED | ERROR | EXPIRED, the agent is done.
```

### D. Watch conversation in real-time

```bash
cursor-agents create \
  --repo owner/repo --ref main \
  --prompt "Add input validation" \
  --watch --json
```

Each stdout line is a JSON object. Parse line-by-line.

### E. Send follow-up instructions

```bash
cursor-agents followup <agent-id> --prompt "Also update the README" --json
cursor-agents wait <agent-id> --json
```

A `followup` also resumes a **stopped** agent, so the same pattern works after
`cursor-agents stop <agent-id>` when you want to redirect the work before letting it continue.

### F. List agents for a specific PR

```bash
cursor-agents list --pr https://github.com/owner/repo/pull/42 --json
```

### G. Retrieve and download artifacts

```bash
# List what the agent produced
cursor-agents artifacts <agent-id> --json
# Download a specific file
cursor-agents download <agent-id> /workspace/src/index.ts --output ./index.ts --json
```

## Error Handling and Recovery

| Exit Code | Error Code | Meaning | Recovery |
|-----------|-----------|---------|----------|
| 0 | -- | Success | Parse `data` from stdout |
| 1 | `bad_request` | Invalid flags or API rejection | Read `error.hint` and `error.nextStep`. Common causes: conflicting flags, invalid model ID. |
| 1 | `validation_error` | Unexpected API response shape | Report to user; may indicate API version mismatch. |
| 2 | `unauthorized` | Bad or missing API key | Verify `CURSOR_API_KEY` is set. Run `auth whoami --json`. |
| 3 | `not_found` | Invalid agent ID | Run `list --json` to find valid agent IDs. |
| 4 | `rate_limited` | Too many requests | Wait 30-60 seconds, then retry. |
| 5 | `timeout` | `--wait`/`--watch` exceeded timeout | Check `status <id> --json`. If still RUNNING, `wait` again with `--timeout <longer>`. |

**Key principle**: Always read `error.hint` and `error.nextStep` when present -- they contain
actionable guidance specific to the failure.

## Decision Tree

Follow this logic when handling a user request:

1. **Pre-flight**
   - Run `cursor-agents auth whoami --json` to verify credentials.
   - Run `cursor-agents models --json` to cache available models.
   - Optionally run `cursor-agents repos --json` to verify repo access.

2. **Determine source**
   - User wants work on a repo/branch: use `--repo` + `--ref`.
   - User wants work on a PR: use `--pr`.

3. **Determine target**
   - New PR from scratch: add `--auto-pr` (repo source only).
   - Follow-up branch on existing PR: add `--auto-branch` (PR source only).
   - Specific branch name: add `--branch-name <name>`.

4. **Determine monitoring**
   - Need to see conversation: add `--watch`.
   - Just need final result: add `--wait`.
   - Fire-and-forget: omit both, poll with `status` later.

5. **Handle terminal state**
   - `FINISHED`: Report success. The `data.summary` field describes what was done.
   - `ERROR`: Run `cursor-agents conversation <id> --json` to understand what went wrong. Report to user.
   - `EXPIRED`: Agent timed out server-side. Inform user, suggest re-running with a simpler prompt or different model.

6. **Follow-up**
   - If the user wants additional changes on the same agent: use `followup <id> --prompt "..." --json`, then `wait <id> --json`.
   - If the agent is already in a terminal state and follow-up is not accepted: create a new agent.

## Important Notes

- `stop` **pauses** a running agent without deleting it. Sending a `followup` to a stopped agent resumes it. Only `stop` if the user explicitly requests it -- even a pause interrupts the agent's current work.
- `delete` is **permanent** -- the agent and all its artifacts are destroyed.
- Up to **5 images** can be attached with `--image <path>` (base64-encoded automatically).
- **Artifacts are retained for 6 months.** `artifacts <id>` and `download <id> <path>` return `400` for older agents. Each endpoint is rate-limited to 300/min and 6000/hour.
- **`repos` is heavily rate-limited**: 1 request/user/minute and 30/user/hour, and can take tens of seconds to respond. Cache the result for the session; do not re-query on every command.
- The CLI version this skill targets: **0.2.0**.
- If the CLI returns unexpected errors, verify the command with `cursor-agents <command> --help`.
