import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { AgentsAPI } from "../../src/agents";
import { BaseClient } from "../../src/client";

const originalFetch = globalThis.fetch;

function mockFetchSequence(responses: Array<{ body: unknown; status?: number }>) {
  let callIndex = 0;
  globalThis.fetch = mock(async () => {
    const resp = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    return new Response(JSON.stringify(resp.body), {
      status: resp.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

function mockFetch(body: unknown, status = 200) {
  mockFetchSequence([{ body, status }]);
}

describe("AgentsAPI", () => {
  let agents: AgentsAPI;

  beforeEach(() => {
    const client = new BaseClient({ apiKey: "test_key" });
    agents = new AgentsAPI(client);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("create sends POST with body", async () => {
    mockFetch({
      id: "agent_1",
      status: "CREATING",
      source: { repository: "https://github.com/foo/bar" },
      createdAt: "2026-04-01T10:00:00Z",
    });

    const result = await agents.create({
      prompt: { text: "Fix the tests" },
      source: { repository: "https://github.com/foo/bar" },
    });
    expect(result.id).toBe("agent_1");
    expect(result.status).toBe("CREATING");

    const call = (globalThis.fetch as ReturnType<typeof mock>).mock.calls[0];
    expect(call[1]?.method).toBe("POST");
  });

  test("list returns paginated agents", async () => {
    mockFetch({
      agents: [
        {
          id: "a1",
          status: "RUNNING",
          source: { repository: "r1" },
          createdAt: "2026-04-01T10:00:00Z",
        },
        {
          id: "a2",
          status: "FINISHED",
          source: { repository: "r2" },
          createdAt: "2026-04-01T11:00:00Z",
        },
      ],
      nextCursor: "cursor_abc",
    });

    const result = await agents.list({ limit: 2 });
    expect(result.agents).toHaveLength(2);
    expect(result.nextCursor).toBe("cursor_abc");
  });

  test("list appends query params", async () => {
    mockFetch({ agents: [] });
    await agents.list({ limit: 5, prUrl: "https://github.com/foo/bar/pull/1" });

    const call = (globalThis.fetch as ReturnType<typeof mock>).mock.calls[0];
    const url = call[0] as string;
    expect(url).toContain("limit=5");
    expect(url).toContain("prUrl=");
  });

  test("get returns single agent", async () => {
    mockFetch({
      id: "agent_1",
      status: "FINISHED",
      source: { repository: "r1" },
      summary: "All done",
      createdAt: "2026-04-01T10:00:00Z",
    });

    const result = await agents.get("agent_1");
    expect(result.id).toBe("agent_1");
    expect(result.summary).toBe("All done");
  });

  test("delete sends DELETE", async () => {
    mockFetch({ id: "agent_1" });
    const result = await agents.delete("agent_1");
    expect(result.id).toBe("agent_1");

    const call = (globalThis.fetch as ReturnType<typeof mock>).mock.calls[0];
    expect(call[1]?.method).toBe("DELETE");
  });

  test("stop sends POST", async () => {
    mockFetch({ id: "agent_1" });
    const result = await agents.stop("agent_1");
    expect(result.id).toBe("agent_1");

    const call = (globalThis.fetch as ReturnType<typeof mock>).mock.calls[0];
    expect(call[1]?.method).toBe("POST");
    expect((call[0] as string).endsWith("/stop")).toBe(true);
  });

  test("followup sends POST with prompt", async () => {
    mockFetch({ id: "agent_1" });
    await agents.followup("agent_1", { prompt: { text: "Do more" } });

    const call = (globalThis.fetch as ReturnType<typeof mock>).mock.calls[0];
    expect(call[1]?.method).toBe("POST");
    const body = JSON.parse(call[1]?.body as string);
    expect(body.prompt.text).toBe("Do more");
  });

  test("conversation returns messages", async () => {
    mockFetch({
      id: "convo_1",
      messages: [
        { id: "m1", type: "user_message", text: "Fix it" },
        { id: "m2", type: "assistant_message", text: "Fixed" },
      ],
    });

    const result = await agents.conversation("agent_1");
    expect(result.messages).toHaveLength(2);
  });

  test("waitFor resolves on terminal status", async () => {
    mockFetchSequence([
      {
        body: {
          id: "a1",
          status: "RUNNING",
          source: { repository: "r" },
          createdAt: "2026-04-01T10:00:00Z",
        },
      },
      {
        body: {
          id: "a1",
          status: "FINISHED",
          source: { repository: "r" },
          createdAt: "2026-04-01T10:00:00Z",
        },
      },
    ]);

    const statuses: string[] = [];
    const result = await agents.waitFor("a1", {
      intervalMs: 10,
      onStatus: (a) => statuses.push(a.status),
    });
    expect(result.status).toBe("FINISHED");
    expect(statuses).toContain("RUNNING");
  });
});
