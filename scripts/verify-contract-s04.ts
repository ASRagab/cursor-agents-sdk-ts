#!/usr/bin/env bun
/**
 * verify-contract-s04.ts
 *
 * Read-only live contract verification for the Cursor Cloud Agents /v0 surface.
 * Performs Zod-based GET checks and writes a timestamped evidence capture.
 *
 * Usage:
 *   bun run scripts/verify-contract-s04.ts
 *
 * Exit codes:
 *   0 — all non-skipped endpoints returned 2xx and matched schema
 *   1 — any non-skipped endpoint failed HTTP or schema validation
 *   2 — CURSOR_API_KEY is not set
 *
 * Security constraints:
 *   - Never logs CURSOR_API_KEY or the Authorization header value.
 *   - Capture files are written under .gsd/ (gitignored).
 *   - Only safe read-only (GET) requests are issued.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  AgentSchema,
  ConversationSchema,
  ListAgentsResponseSchema,
  ListArtifactsResponseSchema,
  MeResponseSchema,
  ModelsResponseSchema,
  RepositoriesResponseSchema,
} from "../src/schemas";

const BASE_URL = process.env.CURSOR_BASE_URL ?? "https://api.cursor.com";
const API_KEY = process.env.CURSOR_API_KEY;
const CAPTURE_DIR = ".gsd/milestones/M001/slices/S04/captures";
const KNOWN_ARRAY_FIELDS = ["agents", "repositories", "messages", "artifacts", "models"] as const;
const PREFERRED_AGENT_STATUSES = new Set(["FINISHED"]);

export interface SchemaIssue {
  path: string;
  message: string;
}

export interface SchemaCheckResult {
  ok: boolean;
  zodIssues?: SchemaIssue[];
  unmodeledFields?: string[];
}

interface EndpointResult {
  endpoint: string;
  status: number;
  schemaOk: boolean;
  skipped?: boolean;
  zodIssues?: SchemaIssue[];
  unmodeledFields?: string[];
  error?: string;
}

interface Capture {
  capturedAt: string;
  baseUrl: string;
  results: EndpointResult[];
}

interface ProbeOutcome {
  body: unknown;
  result: EndpointResult;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getObjectShape(schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> | undefined {
  if (schema instanceof z.ZodObject) {
    return schema.shape as Record<string, z.ZodTypeAny>;
  }
  return undefined;
}

function collectUnmodeledFields(schema: z.ZodTypeAny, body: unknown): string[] | undefined {
  if (!isPlainObject(body)) {
    return undefined;
  }

  const shape = getObjectShape(schema);
  if (!shape) {
    return undefined;
  }

  const extras = new Set<string>();
  const modeledTopLevelKeys = new Set(Object.keys(shape));

  for (const key of Object.keys(body)) {
    if (!modeledTopLevelKeys.has(key)) {
      extras.add(key);
    }
  }

  for (const field of KNOWN_ARRAY_FIELDS) {
    const items = body[field];
    if (!Array.isArray(items)) {
      continue;
    }

    const fieldSchema = shape[field];
    if (!(fieldSchema instanceof z.ZodArray)) {
      continue;
    }

    const itemShape = getObjectShape(fieldSchema.element as z.ZodTypeAny);
    if (!itemShape) {
      continue;
    }

    const modeledItemKeys = new Set(Object.keys(itemShape));
    for (const item of items) {
      if (!isPlainObject(item)) {
        continue;
      }

      for (const key of Object.keys(item)) {
        if (!modeledItemKeys.has(key)) {
          extras.add(`${field}[].${key}`);
        }
      }
    }
  }

  return extras.size > 0 ? Array.from(extras).sort() : undefined;
}

export function checkSchema<T>(
  _endpoint: string,
  schema: z.ZodType<T>,
  body: unknown,
): SchemaCheckResult {
  const result = schema.safeParse(body);

  if (!result.success) {
    return {
      ok: false,
      zodIssues: result.error.issues.slice(0, 10).map((issue) => ({
        path: issue.path.length > 0 ? issue.path.join(".") : "<root>",
        message: issue.message,
      })),
    };
  }

  return {
    ok: true,
    unmodeledFields: collectUnmodeledFields(schema, body),
  };
}

function redactedPreview(body: unknown): string {
  const raw = JSON.stringify(body) ?? "";
  return raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
}

async function getEndpoint(path: string): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${API_KEY}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { status: response.status, body };
}

function printResult(result: EndpointResult): void {
  const tag = result.skipped
    ? "[SKIP]"
    : result.status >= 200 && result.status < 300 && result.schemaOk
      ? "[OK]"
      : "[FAIL]";

  const reason = result.skipped ? "  reason=no agents found in list" : "";
  console.log(
    `${tag} ${result.endpoint} → HTTP ${result.status}  schemaOk=${result.schemaOk}${reason}`,
  );

  if (!result.schemaOk) {
    for (const issue of result.zodIssues?.slice(0, 3) ?? []) {
      console.log(`       ${issue.path}: ${issue.message}`);
    }
  }
}

export function selectProbeAgentId(body: unknown): string | undefined {
  if (!isPlainObject(body) || !Array.isArray(body.agents) || body.agents.length === 0) {
    return undefined;
  }

  const preferredAgent = body.agents.find(
    (agent) =>
      isPlainObject(agent) &&
      typeof agent.id === "string" &&
      typeof agent.status === "string" &&
      PREFERRED_AGENT_STATUSES.has(agent.status),
  );
  if (isPlainObject(preferredAgent) && typeof preferredAgent.id === "string") {
    return preferredAgent.id;
  }

  const firstAgent = body.agents[0];
  if (!isPlainObject(firstAgent) || typeof firstAgent.id !== "string") {
    return undefined;
  }

  return firstAgent.id;
}

async function probeEndpoint<T>(endpoint: string, schema: z.ZodType<T>): Promise<ProbeOutcome> {
  try {
    const { status, body } = await getEndpoint(endpoint);
    const httpOk = status >= 200 && status < 300;

    if (!httpOk) {
      const result: EndpointResult = {
        endpoint,
        status,
        schemaOk: false,
        error: `HTTP ${status}: ${redactedPreview(body)}`,
      };
      printResult(result);
      return { body, result };
    }

    const schemaResult = checkSchema(endpoint, schema, body);
    const result: EndpointResult = {
      endpoint,
      status,
      schemaOk: schemaResult.ok,
      zodIssues: schemaResult.zodIssues,
      unmodeledFields: schemaResult.unmodeledFields,
    };

    printResult(result);
    return { body, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const result: EndpointResult = {
      endpoint,
      status: 0,
      schemaOk: false,
      error: message,
    };
    printResult(result);
    return { body: null, result };
  }
}

function makeSkippedResult(endpoint: string): EndpointResult {
  const result: EndpointResult = {
    endpoint,
    status: 0,
    schemaOk: true,
    skipped: true,
    error: "skipped — no agents found in list",
  };
  printResult(result);
  return result;
}

async function main(): Promise<void> {
  if (!API_KEY) {
    console.error(
      [
        "Error: CURSOR_API_KEY is not set.",
        "Set it in your environment or .env file, then re-run:",
        "  export CURSOR_API_KEY=<your-key>",
        "  bun run verify:s04",
      ].join("\n"),
    );
    process.exit(2);
  }

  const results: EndpointResult[] = [];

  results.push((await probeEndpoint("/v0/me", MeResponseSchema)).result);
  results.push((await probeEndpoint("/v0/models", ModelsResponseSchema)).result);
  results.push((await probeEndpoint("/v0/repositories", RepositoriesResponseSchema)).result);

  const agentsProbe = await probeEndpoint("/v0/agents?limit=25", ListAgentsResponseSchema);
  results.push(agentsProbe.result);

  const firstAgentId = selectProbeAgentId(agentsProbe.body);
  if (!firstAgentId) {
    results.push(makeSkippedResult("/v0/agents/{firstAgentId}"));
    results.push(makeSkippedResult("/v0/agents/{firstAgentId}/conversation"));
    results.push(makeSkippedResult("/v0/agents/{firstAgentId}/artifacts"));
  } else {
    results.push((await probeEndpoint(`/v0/agents/${firstAgentId}`, AgentSchema)).result);
    results.push(
      (await probeEndpoint(`/v0/agents/${firstAgentId}/conversation`, ConversationSchema)).result,
    );
    results.push(
      (await probeEndpoint(`/v0/agents/${firstAgentId}/artifacts`, ListArtifactsResponseSchema))
        .result,
    );
  }

  const captureDir = join(process.cwd(), CAPTURE_DIR);
  await mkdir(captureDir, { recursive: true });

  const capturedAt = new Date().toISOString();
  const timestamp = capturedAt.replace(/[:.]/g, "-");
  const capturePath = join(captureDir, `${timestamp}.json`);

  const capture: Capture = {
    capturedAt,
    baseUrl: BASE_URL,
    results,
  };

  await writeFile(capturePath, JSON.stringify(capture, null, 2));
  console.log(`\nCapture written → ${capturePath}`);

  const failed = results.some(
    (result) =>
      !result.skipped && (result.status < 200 || result.status >= 300 || !result.schemaOk),
  );

  process.exit(failed ? 1 : 0);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error("Fatal:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
