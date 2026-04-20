import { CursorAgentsError } from "../errors";
import type { Agent } from "../schemas";

const EXIT_CODES: Record<string, number> = {
  unauthorized: 2,
  not_found: 3,
  rate_limited: 4,
  timeout: 5,
};

export function exitCodeForError(err: unknown): number {
  if (err instanceof CursorAgentsError) {
    return EXIT_CODES[err.code] ?? 1;
  }
  return 1;
}

export function formatJson(ok: boolean, data: unknown): string {
  return JSON.stringify(ok ? { ok: true, data } : { ok: false, error: data });
}

export function printResult(data: unknown, json: boolean): void {
  if (json) {
    process.stdout.write(`${formatJson(true, data)}\n`);
  } else {
    if (typeof data === "string") {
      process.stdout.write(`${data}\n`);
    } else {
      process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
    }
  }
}

export function printError(err: unknown, json: boolean): void {
  if (json) {
    if (err instanceof CursorAgentsError) {
      process.stdout.write(
        `${formatJson(false, {
          code: err.code,
          message: err.message,
          status: err.status,
          ...err.details,
        })}\n`,
      );
    } else {
      process.stdout.write(
        `${formatJson(false, { code: "unknown_error", message: String(err) })}\n`,
      );
    }
  } else {
    if (err instanceof CursorAgentsError) {
      process.stderr.write(`Error [${err.code}]: ${err.message}\n`);
      if (err.details?.hint) {
        process.stderr.write(`Hint: ${err.details.hint}\n`);
      }
      if (err.details?.suggestions && err.details.suggestions.length > 0) {
        process.stderr.write(`Suggestions: ${err.details.suggestions.join(", ")}\n`);
      }
      if (err.details?.nextStep) {
        process.stderr.write(`Next step: ${err.details.nextStep}\n`);
      }
    } else {
      process.stderr.write(`Error: ${String(err)}\n`);
    }
  }
}

export function formatAgent(agent: Agent): string {
  const lines = [`Agent: ${agent.id}`, `Status: ${agent.status}`];
  if (agent.name) lines.push(`Name: ${agent.name}`);
  if (agent.source.repository) lines.push(`Repo: ${agent.source.repository}`);
  if (agent.summary) lines.push(`Summary: ${agent.summary}`);
  if (agent.filesChanged !== undefined) lines.push(`Files changed: ${agent.filesChanged}`);
  if (agent.linesAdded !== undefined) lines.push(`Lines added: ${agent.linesAdded}`);
  if (agent.linesRemoved !== undefined) lines.push(`Lines removed: ${agent.linesRemoved}`);
  if (
    agent.target?.url &&
    agent.target.url !== agent.source.repository &&
    agent.target.url !== agent.source.prUrl
  ) {
    lines.push(`Target URL: ${agent.target.url}`);
  }
  if (agent.target?.prUrl) lines.push(`Target PR: ${agent.target.prUrl}`);
  if (agent.createdAt) lines.push(`Created: ${agent.createdAt}`);
  return lines.join("\n");
}

export function formatAgentList(
  agents: Array<{
    id: string;
    status: string;
    source?: { repository?: string };
    createdAt?: string;
  }>,
  nextCursor?: string,
): string {
  if (agents.length === 0) return "No agents found.";
  const rows = agents.map((a) => `  ${a.id}  ${a.status.padEnd(10)} ${a.source?.repository ?? ""}`);
  const out = ["ID          STATUS     REPO", ...rows];
  if (nextCursor) out.push(`\nNext cursor: ${nextCursor}`);
  return out.join("\n");
}
