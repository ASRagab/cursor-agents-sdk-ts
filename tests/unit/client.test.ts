import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { BaseClient } from "../../src/client";
import { CursorAgentsError } from "../../src/errors";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
const originalCwd = process.cwd();

let tempDir: string | undefined;

function mockFetch(body: unknown, status = 200) {
  globalThis.fetch = mock(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  ) as typeof fetch;
}

describe("BaseClient constructor", () => {
  beforeEach(() => {
    delete process.env.CURSOR_API_KEY;
    delete process.env.CURSOR_BASE_URL;
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
    globalThis.fetch = originalFetch;
    process.chdir(originalCwd);
    if (tempDir) {
      rmSync(tempDir, { force: true, recursive: true });
      tempDir = undefined;
    }
  });

  test("throws when no API key provided", () => {
    tempDir = mkdtempSync(join(tmpdir(), "cursor-agents-no-env-"));
    process.chdir(tempDir);

    expect(() => new BaseClient()).toThrow(CursorAgentsError);
    try {
      new BaseClient();
    } catch (e) {
      expect((e as CursorAgentsError).code).toBe("unauthorized");
    }
  });

  test("reads API key from env", () => {
    process.env.CURSOR_API_KEY = "test_key";
    const client = new BaseClient();
    expect(client).toBeDefined();
  });

  test("reads API key from .env", () => {
    tempDir = mkdtempSync(join(tmpdir(), "cursor-agents-env-"));
    writeFileSync(join(tempDir, ".env"), 'CURSOR_API_KEY="dotenv_key"\n');
    process.chdir(tempDir);

    const client = new BaseClient();
    expect(client).toBeDefined();
  });

  test("explicit key overrides env", () => {
    process.env.CURSOR_API_KEY = "env_key";
    const client = new BaseClient({ apiKey: "explicit_key" });
    expect(client).toBeDefined();
  });

  test("environment variables override .env", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "cursor-agents-env-"));
    writeFileSync(
      join(tempDir, ".env"),
      "CURSOR_API_KEY=dotenv_key\nCURSOR_BASE_URL=https://dotenv.api.com\n",
    );
    process.chdir(tempDir);
    process.env.CURSOR_API_KEY = "env_key";
    process.env.CURSOR_BASE_URL = "https://env.api.com";

    mockFetch({ name: "test", value: 42 });
    const client = new BaseClient();
    await client.request("/v0/test", z.object({ name: z.string(), value: z.number() }));

    const call = (globalThis.fetch as ReturnType<typeof mock>).mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from("env_key:").toString("base64")}`);
    expect(call[0]).toBe("https://env.api.com/v0/test");
  });
});

describe("BaseClient.request", () => {
  const testSchema = z.object({ name: z.string(), value: z.number() });

  beforeEach(() => {
    delete process.env.CURSOR_BASE_URL;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.assign(process.env, originalEnv);
    process.chdir(originalCwd);
    if (tempDir) {
      rmSync(tempDir, { force: true, recursive: true });
      tempDir = undefined;
    }
  });

  test("sends basic auth header", async () => {
    mockFetch({ name: "test", value: 42 });
    const client = new BaseClient({ apiKey: "my_key" });
    await client.request("/v0/test", testSchema);

    const call = (globalThis.fetch as ReturnType<typeof mock>).mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from("my_key:").toString("base64")}`);
  });

  test("parses successful response with schema", async () => {
    mockFetch({ name: "test", value: 42 });
    const client = new BaseClient({ apiKey: "key" });
    const result = await client.request("/v0/test", testSchema);
    expect(result).toEqual({ name: "test", value: 42 });
  });

  test("throws on HTTP error with mapped code", async () => {
    mockFetch({ error: { message: "Not found" } }, 404);
    const client = new BaseClient({ apiKey: "key" });

    try {
      await client.request("/v0/test", testSchema);
      expect(true).toBe(false); // should not reach
    } catch (e) {
      expect(e).toBeInstanceOf(CursorAgentsError);
      const err = e as CursorAgentsError;
      expect(err.code).toBe("not_found");
      expect(err.status).toBe(404);
    }
  });

  test("throws on schema validation failure", async () => {
    mockFetch({ name: "test", value: "not_a_number" });
    const client = new BaseClient({ apiKey: "key" });

    try {
      await client.request("/v0/test", testSchema);
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(CursorAgentsError);
      const err = e as CursorAgentsError;
      expect(err.code).toBe("validation_error");
    }
  });

  test("uses custom base URL", async () => {
    mockFetch({ name: "test", value: 1 });
    const client = new BaseClient({ apiKey: "key", baseUrl: "https://custom.api.com" });
    await client.request("/v0/test", testSchema);

    const call = (globalThis.fetch as ReturnType<typeof mock>).mock.calls[0];
    expect(call[0]).toBe("https://custom.api.com/v0/test");
  });

  test("reads base URL from .env", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "cursor-agents-env-"));
    writeFileSync(
      join(tempDir, ".env"),
      "CURSOR_API_KEY=dotenv_key\nCURSOR_BASE_URL=https://dotenv.api.com\n",
    );
    process.chdir(tempDir);

    mockFetch({ name: "test", value: 1 });
    const client = new BaseClient();
    await client.request("/v0/test", testSchema);

    const call = (globalThis.fetch as ReturnType<typeof mock>).mock.calls[0];
    expect(call[0]).toBe("https://dotenv.api.com/v0/test");
  });
});
