import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { ArtifactsAPI } from "../../src/artifacts";
import { BaseClient } from "../../src/client";

const originalFetch = globalThis.fetch;

function mockFetch(body: unknown, status = 200) {
  globalThis.fetch = mock(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  ) as typeof fetch;
}

describe("ArtifactsAPI", () => {
  let artifacts: ArtifactsAPI;

  beforeEach(() => {
    const client = new BaseClient({ apiKey: "test_key" });
    artifacts = new ArtifactsAPI(client);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("list returns artifacts", async () => {
    mockFetch({
      artifacts: [
        { absolutePath: "/src/index.ts", sizeBytes: 500, updatedAt: "2026-04-01T10:00:00Z" },
        { absolutePath: "/src/main.ts", sizeBytes: 1200, updatedAt: "2026-04-01T11:00:00Z" },
      ],
    });

    const result = await artifacts.list("agent_1");
    expect(result.artifacts).toHaveLength(2);
    expect(result.artifacts[0].absolutePath).toBe("/src/index.ts");
  });

  test("downloadUrl returns presigned URL", async () => {
    mockFetch({
      url: "https://s3.example.com/presigned",
      expiresAt: "2026-04-01T10:15:00Z",
    });

    const result = await artifacts.downloadUrl("agent_1", "/src/index.ts");
    expect(result.url).toBe("https://s3.example.com/presigned");
    expect(result.expiresAt).toBe("2026-04-01T10:15:00Z");
  });

  test("downloadUrl encodes path in query params", async () => {
    mockFetch({ url: "https://s3.example.com/x", expiresAt: "2026-04-01T10:15:00Z" });
    await artifacts.downloadUrl("agent_1", "/src/my file.ts");

    const call = (globalThis.fetch as ReturnType<typeof mock>).mock.calls[0];
    const url = call[0] as string;
    expect(url).toContain("path=");
    expect(url).toContain("my+file.ts");
  });
});
