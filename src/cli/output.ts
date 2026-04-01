import { CursorAgentsError } from "../errors";

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
        `${formatJson(false, { code: err.code, message: err.message, status: err.status })}\n`,
      );
    } else {
      process.stdout.write(
        `${formatJson(false, { code: "unknown_error", message: String(err) })}\n`,
      );
    }
  } else {
    if (err instanceof CursorAgentsError) {
      process.stderr.write(`Error [${err.code}]: ${err.message}\n`);
    } else {
      process.stderr.write(`Error: ${String(err)}\n`);
    }
  }
}

export function formatAgent(agent: {
  id: string;
  status: string;
  source?: { repository?: string };
  summary?: string;
  createdAt?: string;
  name?: string;
}): string {
  const lines = [`Agent: ${agent.id}`, `Status: ${agent.status}`];
  if (agent.name) lines.push(`Name: ${agent.name}`);
  if (agent.source?.repository) lines.push(`Repo: ${agent.source.repository}`);
  if (agent.summary) lines.push(`Summary: ${agent.summary}`);
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
