import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { z } from "zod";
import { BaseClient } from "../../src/client";
import { CursorAgentsError } from "../../src/errors";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

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
  });

  test("throws when no API key provided", () => {
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

  test("explicit key overrides env", () => {
    process.env.CURSOR_API_KEY = "env_key";
    const client = new BaseClient({ apiKey: "explicit_key" });
    expect(client).toBeDefined();
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
  });

  test("sends auth header", async () => {
    mockFetch({ name: "test", value: 42 });
    const client = new BaseClient({ apiKey: "my_key" });
    await client.request("/v0/test", testSchema);

    const call = (globalThis.fetch as ReturnType<typeof mock>).mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer my_key");
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
});
