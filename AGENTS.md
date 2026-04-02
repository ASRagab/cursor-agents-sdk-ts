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

## Project Structure & Module Organization

Source lives in `src/`. Core SDK modules (`client.ts`, `agents.ts`, `artifacts.ts`, `schemas.ts`, `errors.ts`) are re-exported through `src/index.ts`. CLI command definitions live in `src/cli/commands/`, the packaged launcher lives in `bin/`, and build automation lives in `scripts/`. Tests are split between `tests/unit/` and `tests/integration/`. Treat `dist/` as generated output only.

## Coding Style & Naming Conventions

TypeScript uses ES modules with `strict` mode. Biome enforces 2-space indentation and 100-column lines. Use `PascalCase` for classes and exported types, `camelCase` for functions and variables, and lowercase descriptive filenames such as `client.ts` or `artifacts.ts`. Keep CLI behavior in `src/cli/commands/<topic>.ts` and reserve `bin/` for thin launch wrappers.

## Testing Guidelines

Write Bun tests in `*.test.ts` files. Mock network calls in unit tests and reserve `tests/integration/` for live API flows guarded by `CURSOR_API_KEY`. There is no formal coverage gate, so add or update tests whenever SDK contracts, CLI output, or packaging behavior changes.

## Commit & Pull Request Guidelines

History follows Conventional Commits such as `feat:`, `fix:`, and `chore:` with short imperative subjects. Keep commits focused. PRs should list the verification commands you ran (`bun run typecheck`, `bun run lint`, relevant tests), link related issues, and include sample terminal output when a command surface changes.

## Security & Configuration Tips

Set `CURSOR_API_KEY` for local development. Use `CURSOR_BASE_URL` only when testing a non-default API endpoint. Never commit secrets, captured tokens, or artifact payloads containing repository data.
