#!/usr/bin/env bun
/**
 * verify-contract-s01.ts
 *
 * Read-only live contract verification for the Cursor Cloud Agents /v0 surface.
 * Performs raw (non-Zod) GET requests; never modifies server state.
 *
 * Usage:
 *   bun run scripts/verify-contract-s01.ts
 *
 * Exit codes:
 *   0 — all endpoints returned 2xx
 *   1 — any non-2xx response or transport error
 *   2 — CURSOR_API_KEY is not set
 *
 * Security constraints:
 *   - Never logs CURSOR_API_KEY or the Authorization header value.
 *   - Capture files are written under .gsd/ (gitignored).
 *   - Only safe read-only (GET) requests are issued.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// ─── config ──────────────────────────────────────────────────────────────────

const BASE_URL = process.env.CURSOR_BASE_URL ?? "https://api.cursor.com";
const API_KEY = process.env.CURSOR_API_KEY;

if (!API_KEY) {
  console.error(
    [
      "Error: CURSOR_API_KEY is not set.",
      "Set it in your environment or .env file, then re-run:",
      "  export CURSOR_API_KEY=<your-key>",
      "  bun run scripts/verify-contract-s01.ts",
    ].join("\n"),
  );
  process.exit(2);
}

// ─── types ───────────────────────────────────────────────────────────────────

interface EndpointResult {
  endpoint: string;
  status: number;
  ok: boolean;
  topLevelKeys: string[];
  /** Union of all observed keys per named array field (e.g. "agents", "repositories"). */
  itemFieldSets?: Record<string, string[]>;
  error?: string;
}

interface Capture {
  capturedAt: string;
  baseUrl: string;
  results: EndpointResult[];
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Collect direct keys + one level of nested-object keys so that
 * source.repository, target.autoCreatePr, etc. are surfaced.
 */
function flattenKeys(obj: Record<string, unknown>): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    keys.push(k);
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      for (const nested of Object.keys(v as Record<string, unknown>)) {
        keys.push(`${k}.${nested}`);
      }
    }
  }
  return keys;
}

/** Union of all observed field keys across an array of items. */
function unionFieldSet(items: unknown[]): string[] {
  const seen = new Set<string>();
  for (const item of items) {
    if (item !== null && typeof item === "object" && !Array.isArray(item)) {
      for (const k of flattenKeys(item as Record<string, unknown>)) {
        seen.add(k);
      }
    }
  }
  return Array.from(seen).sort();
}

/** Safely redact and truncate a response body for error messages. */
function redactedPreview(body: unknown): string {
  const raw = JSON.stringify(body) ?? "";
  return raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
}

/** Issue a GET request; returns status + parsed JSON body. */
async function getEndpoint(path: string): Promise<{ status: number; body: unknown }> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      // Key is never logged or echoed
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

/** Collect top-level keys and itemFieldSets from a parsed JSON body. */
function inspectBody(body: unknown): {
  topLevelKeys: string[];
  itemFieldSets: Record<string, string[]>;
} {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { topLevelKeys: [], itemFieldSets: {} };
  }
  const obj = body as Record<string, unknown>;
  const topLevelKeys = Object.keys(obj);
  const itemFieldSets: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      itemFieldSets[k] = unionFieldSet(v);
    }
  }
  return { topLevelKeys, itemFieldSets };
}

/** Print the per-endpoint summary line plus any array field unions. */
function printResult(
  ep: string,
  status: number,
  topLevelKeys: string[],
  itemFieldSets?: Record<string, string[]>,
  extra?: string,
) {
  const tag = `[OK]   `;
  const suffix = extra ? `  ${extra}` : "";
  console.log(`${tag}${ep} → ${status}  keys=${topLevelKeys.join(", ")}${suffix}`);
  if (itemFieldSets) {
    for (const [k, fields] of Object.entries(itemFieldSets)) {
      if (fields.length > 0) {
        console.log(`         .${k}[] field union: ${fields.join(", ")}`);
      }
    }
  }
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const results: EndpointResult[] = [];
  let hasError = false;

  // Helper: wrap a single endpoint call with uniform error handling
  async function probe(
    ep: string,
    extra?: (body: unknown) => string | undefined,
  ): Promise<EndpointResult> {
    try {
      const { status, body } = await getEndpoint(ep);

      if (status < 200 || status >= 300) {
        console.error(`[FAIL] ${ep} → HTTP ${status}: ${redactedPreview(body)}`);
        hasError = true;
        return { endpoint: ep, status, ok: false, topLevelKeys: [], error: `HTTP ${status}` };
      }

      const { topLevelKeys, itemFieldSets } = inspectBody(body);
      const extraMsg = extra?.(body);
      printResult(ep, status, topLevelKeys, itemFieldSets, extraMsg);
      return { endpoint: ep, status, ok: true, topLevelKeys, itemFieldSets };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ERR]  ${ep} → transport error: ${msg}`);
      hasError = true;
      return { endpoint: ep, status: 0, ok: false, topLevelKeys: [], error: msg };
    }
  }

  // ── /v0/me ──────────────────────────────────────────────────────────────
  results.push(await probe("/v0/me"));

  // ── /v0/models ──────────────────────────────────────────────────────────
  results.push(await probe("/v0/models"));

  // ── /v0/repositories ────────────────────────────────────────────────────
  results.push(await probe("/v0/repositories"));

  // ── /v0/agents?limit=25 ─────────────────────────────────────────────────
  let firstAgentId: string | undefined;
  const agentsResult = await probe("/v0/agents?limit=25", (body) => {
    if (body !== null && typeof body === "object") {
      const obj = body as Record<string, unknown>;
      if (Array.isArray(obj.agents) && obj.agents.length > 0) {
        const first = obj.agents[0];
        if (first !== null && typeof first === "object" && "id" in first) {
          firstAgentId = (first as Record<string, unknown>).id as string;
          return `firstAgentId=${firstAgentId}`;
        }
      }
    }
    return "agents=[]";
  });
  results.push(agentsResult);

  // Per-agent endpoints require a real agent id from the list
  if (!firstAgentId) {
    console.log("[SKIP] /v0/agents/{id}              — no agents found in list");
    console.log("[SKIP] /v0/agents/{id}/conversation  — no agents found in list");
    console.log("[SKIP] /v0/agents/{id}/artifacts     — no agents found in list");
    results.push(
      {
        endpoint: "/v0/agents/{id}",
        status: 0,
        ok: true,
        topLevelKeys: [],
        error: "skipped — no agents",
      },
      {
        endpoint: "/v0/agents/{id}/conversation",
        status: 0,
        ok: true,
        topLevelKeys: [],
        error: "skipped — no agents",
      },
      {
        endpoint: "/v0/agents/{id}/artifacts",
        status: 0,
        ok: true,
        topLevelKeys: [],
        error: "skipped — no agents",
      },
    );
  } else {
    // ── /v0/agents/{id} ───────────────────────────────────────────────────
    // Use flattenKeys for single-object response to surface nested source.* / target.*
    try {
      const ep = `/v0/agents/${firstAgentId}`;
      const { status, body } = await getEndpoint(ep);
      if (status < 200 || status >= 300) {
        console.error(`[FAIL] ${ep} → HTTP ${status}: ${redactedPreview(body)}`);
        hasError = true;
        results.push({
          endpoint: ep,
          status,
          ok: false,
          topLevelKeys: [],
          error: `HTTP ${status}`,
        });
      } else {
        const topLevelKeys =
          body !== null && typeof body === "object" && !Array.isArray(body)
            ? flattenKeys(body as Record<string, unknown>)
            : [];
        printResult(ep, status, topLevelKeys);
        results.push({ endpoint: ep, status, ok: true, topLevelKeys });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const ep = `/v0/agents/${firstAgentId}`;
      console.error(`[ERR]  ${ep} → transport error: ${msg}`);
      hasError = true;
      results.push({ endpoint: ep, status: 0, ok: false, topLevelKeys: [], error: msg });
    }

    // ── /v0/agents/{id}/conversation ──────────────────────────────────────
    results.push(await probe(`/v0/agents/${firstAgentId}/conversation`));

    // ── /v0/agents/{id}/artifacts ─────────────────────────────────────────
    results.push(await probe(`/v0/agents/${firstAgentId}/artifacts`));
  }

  // ── write timestamped capture ────────────────────────────────────────────
  const captureDir = join(process.cwd(), ".gsd/milestones/M001/slices/S01/captures");
  await mkdir(captureDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const capturePath = join(captureDir, `${timestamp}.json`);

  const capture: Capture = {
    capturedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    // API key is intentionally excluded
    results,
  };

  await writeFile(capturePath, JSON.stringify(capture, null, 2));
  console.log(`\nCapture written → ${capturePath}`);

  const passed = results.filter((r) => r.ok).length;
  if (hasError) {
    console.error(`\n[SUMMARY] ${passed}/${results.length} endpoints OK — failures above.`);
    process.exit(1);
  }
  console.log(`\n[SUMMARY] ${passed}/${results.length} endpoints OK`);
}

main().catch((err: unknown) => {
  console.error("Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
