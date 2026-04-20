import { describe, expect, test } from "bun:test";
import type { ZodType } from "zod";
import { CursorAgents } from "../../src/index";
import {
  AgentSchema,
  ConversationSchema,
  CreateAgentResponseSchema,
  ListAgentsResponseSchema,
  ListArtifactsResponseSchema,
  MeResponseSchema,
  ModelsResponseSchema,
  RepositoriesResponseSchema,
} from "../../src/schemas";

const API_KEY = process.env.CURSOR_API_KEY;
const READ_ONLY_TIMEOUT_MS = 15_000;
const AGENT_SCHEMA_KEYS = new Set([
  "id",
  "name",
  "status",
  "source",
  "target",
  "summary",
  "filesChanged",
  "linesAdded",
  "linesRemoved",
  "createdAt",
]);

type CapturedResponse = {
  body: unknown;
  status: number;
  url: string;
};

function formatIssuePath(path: PropertyKey[]): string {
  if (path.length === 0) {
    return "<root>";
  }

  return path
    .map((segment) => (typeof segment === "number" ? `[${segment}]` : String(segment)))
    .join(".")
    .replace(/\.\[/g, "[");
}

function formatSchemaIssues(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}): string {
  return error.issues.map((issue) => `${formatIssuePath(issue.path)}: ${issue.message}`).join("\n");
}

function assertSchema<T>(label: string, schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new Error(`${label} schema validation failed:\n${formatSchemaIssues(result.error)}`);
  }

  return result.data;
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) {
    return init.method.toUpperCase();
  }

  if (input instanceof Request) {
    return input.method.toUpperCase();
  }

  return "GET";
}

async function captureEndpointSchema<TValue, TSchema>(
  label: string,
  schema: ZodType<TSchema>,
  match: (url: URL, method: string) => boolean,
  run: () => Promise<TValue>,
): Promise<{ value: TValue; raw: unknown; parsed: TSchema; status: number; url: string }> {
  const originalFetch = globalThis.fetch.bind(globalThis);
  let captured: CapturedResponse | undefined;

  const capturingFetch = Object.assign(async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await originalFetch(input, init);
    const urlString = getRequestUrl(input);
    const method = getRequestMethod(input, init);
    const url = new URL(urlString);

    if (match(url, method)) {
      let body: unknown;
      try {
        body = await response.clone().json();
      } catch {
        body = undefined;
      }

      captured = {
        body,
        status: response.status,
        url: url.toString(),
      };
    }

    return response;
  }, originalFetch) as typeof fetch;

  globalThis.fetch = capturingFetch;

  try {
    const value = await run();
    expect(captured, `${label} did not capture a matching raw response`).toBeDefined();

    const matched = captured as CapturedResponse;
    const parsed = assertSchema(label, schema, matched.body);

    return {
      value,
      raw: matched.body,
      parsed,
      status: matched.status,
      url: matched.url,
    };
  } catch (error) {
    if (captured) {
      assertSchema(label, schema, captured.body);
    }

    throw error;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function logFinishedAgentAdditiveFields(raw: unknown): void {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    console.log("FINISHED agent additive fields: unavailable");
    return;
  }

  const additiveFields = Object.keys(raw).filter((key) => !AGENT_SCHEMA_KEYS.has(key));
  console.log(
    additiveFields.length === 0
      ? "FINISHED agent additive fields: none"
      : `FINISHED agent additive fields: ${additiveFields.join(", ")}`,
  );
}

describe("Integration: Cursor Cloud Agents API", () => {
  if (!API_KEY) {
    test("skipped: CURSOR_API_KEY not set", () => {
      console.log("Set CURSOR_API_KEY environment variable to run integration tests");
      expect(true).toBe(true);
    });
    return;
  }

  let client: CursorAgents;

  test("setup client", () => {
    client = new CursorAgents();
    expect(client).toBeDefined();
  });

  test(
    "whoami returns key info",
    async () => {
      const { value: me, parsed } = await captureEndpointSchema(
        "whoami",
        MeResponseSchema,
        (url, method) => method === "GET" && url.pathname === "/v0/me",
        () => client.me(),
      );

      expect(me.apiKeyName).toBeDefined();
      expect(me.createdAt).toBeDefined();
      expect(parsed.apiKeyName).toBe(me.apiKeyName);
    },
    READ_ONLY_TIMEOUT_MS,
  );

  test(
    "models returns available models",
    async () => {
      const { value: result, parsed } = await captureEndpointSchema(
        "models",
        ModelsResponseSchema,
        (url, method) => method === "GET" && url.pathname === "/v0/models",
        () => client.models(),
      );

      expect(result.models).toBeInstanceOf(Array);
      expect(result.models.length).toBeGreaterThan(0);
      expect(parsed.models).toEqual(result.models);
    },
    READ_ONLY_TIMEOUT_MS,
  );

  test(
    "repositories returns accessible repos",
    async () => {
      const { value: result, parsed } = await captureEndpointSchema(
        "repositories",
        RepositoriesResponseSchema,
        (url, method) => method === "GET" && url.pathname === "/v0/repositories",
        () => client.repositories(),
      );

      expect(result.repositories).toBeInstanceOf(Array);
      expect(parsed.repositories).toEqual(result.repositories);

      for (const repo of parsed.repositories) {
        expect(repo.repository.trim().length).toBeGreaterThan(0);
      }
    },
    READ_ONLY_TIMEOUT_MS,
  );

  test("agent lifecycle: create, wait, conversation, delete", async () => {
    const repos = await client.repositories();
    if (repos.repositories.length === 0) {
      console.log("Skipping agent lifecycle: no repositories accessible");
      return;
    }

    const repo = repos.repositories[0];
    expect(repo.repository.trim().length).toBeGreaterThan(0);

    const { value: created, parsed: parsedCreated } = await captureEndpointSchema(
      "create agent",
      CreateAgentResponseSchema,
      (url, method) => method === "POST" && url.pathname === "/v0/agents",
      () =>
        client.agents.create({
          prompt: {
            text: "List the files in the root directory of this repo. Just list them, nothing else.",
          },
          source: { repository: repo.repository },
        }),
    );
    expect(created.id).toBeDefined();
    expect(created.status).toBe("CREATING");
    expect(parsedCreated.source.repository).toBe(repo.repository);

    const {
      value: completed,
      raw: rawCompleted,
      parsed: parsedCompleted,
    } = await captureEndpointSchema(
      "waitFor agent",
      AgentSchema,
      (url, method) => method === "GET" && url.pathname === `/v0/agents/${created.id}`,
      () =>
        client.agents.waitFor(created.id, {
          intervalMs: 5000,
          timeoutMs: 300_000,
        }),
    );
    expect(["FINISHED", "ERROR", "EXPIRED"]).toContain(completed.status);
    expect(parsedCompleted.status).toBe(completed.status);

    if (completed.status === "FINISHED") {
      logFinishedAgentAdditiveFields(rawCompleted);
    }

    const { value: convo, parsed: parsedConversation } = await captureEndpointSchema(
      "agent conversation",
      ConversationSchema,
      (url, method) => method === "GET" && url.pathname === `/v0/agents/${created.id}/conversation`,
      () => client.agents.conversation(created.id),
    );
    expect(convo.messages.length).toBeGreaterThan(0);
    expect(parsedConversation.messages).toEqual(convo.messages);

    const { value: artifacts, parsed: parsedArtifacts } = await captureEndpointSchema(
      "agent artifacts",
      ListArtifactsResponseSchema,
      (url, method) => method === "GET" && url.pathname === `/v0/agents/${created.id}/artifacts`,
      () => client.agents.artifacts.list(created.id),
    );
    expect(artifacts.artifacts).toBeInstanceOf(Array);
    expect(parsedArtifacts.artifacts).toEqual(artifacts.artifacts);

    const deleted = await client.agents.delete(created.id);
    expect(deleted.id).toBe(created.id);
  }, 360_000);

  test(
    "list agents",
    async () => {
      const { value: result, parsed } = await captureEndpointSchema(
        "list agents",
        ListAgentsResponseSchema,
        (url, method) => method === "GET" && url.pathname === "/v0/agents",
        () => client.agents.list({ limit: 5 }),
      );

      expect(result.agents).toBeInstanceOf(Array);
      expect(parsed.agents).toEqual(result.agents);
    },
    READ_ONLY_TIMEOUT_MS,
  );
});
