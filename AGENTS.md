# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

`cursor-agents` is a TypeScript SDK and CLI for the Cursor Cloud Agents API. It is a single-package project (not a monorepo) using **Bun** as its runtime, package manager, and test runner. See `README.md` for full SDK/CLI documentation.

### Key commands

All standard dev commands are in `package.json` scripts:

| Task | Command |
|------|---------|
| Install deps | `bun install` |
| Lint (Biome) | `bun run lint` |
| Auto-fix lint | `bun run lint:fix` |
| Type check | `bun run typecheck` |
| Unit tests | `bun test tests/unit` (or `bun run test`) |
| Integration tests | `bun test tests/integration` (requires `CURSOR_API_KEY`) |
| Build | `bun run build` |
| Run CLI | `bun run src/cli/index.ts <command>` |

### Non-obvious caveats

- **Bun is required** — the project uses `bun.lock`, `bun:test`, and `@types/bun`. Node/npm/pnpm will not work as a drop-in replacement for running tests or the CLI in dev mode.
- **Bun may not be pre-installed** in new Cloud Agent VMs. If missing, install via `npm install -g bun` (the `curl` installer may fail due to network restrictions).
- **Integration tests require `CURSOR_API_KEY`** env var and outbound HTTPS to `api.cursor.com`. Unit tests mock `fetch` and need no network access.
- **Biome v2** is used for linting/formatting (not ESLint/Prettier). Config is in `biome.json`.
- **CLI entry point** is `src/cli/index.ts` — run directly with `bun run src/cli/index.ts`. The `bin` field in `package.json` maps `cursor-agents` to this file.
- **No external services needed** for development. There are no databases, Docker containers, or background services to manage. All unit tests are self-contained with mocked `fetch`.
