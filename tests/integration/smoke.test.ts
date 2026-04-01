import { describe, expect, test } from "bun:test";
import { CursorAgents } from "../../src/index";

const API_KEY = process.env.CURSOR_API_KEY;

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

  test("whoami returns key info", async () => {
    const me = await client.me();
    expect(me.apiKeyName).toBeDefined();
    expect(me.createdAt).toBeDefined();
  });

  test("models returns available models", async () => {
    const result = await client.models();
    expect(result.models).toBeInstanceOf(Array);
    expect(result.models.length).toBeGreaterThan(0);
  });

  test("repositories returns accessible repos", async () => {
    const result = await client.repositories();
    expect(result.repositories).toBeInstanceOf(Array);
  });

  test("agent lifecycle: create, wait, conversation, delete", async () => {
    const repos = await client.repositories();
    if (repos.repositories.length === 0) {
      console.log("Skipping agent lifecycle: no repositories accessible");
      return;
    }

    const repo = repos.repositories[0];
    const created = await client.agents.create({
      prompt: {
        text: "List the files in the root directory of this repo. Just list them, nothing else.",
      },
      source: { repository: repo.url },
    });
    expect(created.id).toBeDefined();
    expect(created.status).toBe("CREATING");

    const completed = await client.agents.waitFor(created.id, {
      intervalMs: 5000,
      timeoutMs: 300_000,
    });
    expect(["FINISHED", "ERROR", "EXPIRED"]).toContain(completed.status);

    const convo = await client.agents.conversation(created.id);
    expect(convo.messages.length).toBeGreaterThan(0);

    const artifacts = await client.agents.artifacts.list(created.id);
    expect(artifacts.artifacts).toBeInstanceOf(Array);

    const deleted = await client.agents.delete(created.id);
    expect(deleted.id).toBe(created.id);
  }, 360_000);

  test("list agents", async () => {
    const result = await client.agents.list({ limit: 5 });
    expect(result.agents).toBeInstanceOf(Array);
  });
});
