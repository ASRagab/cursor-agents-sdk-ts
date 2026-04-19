import { describe, expect, test } from "bun:test";
import { checkSchema, selectProbeAgentId } from "../../scripts/verify-contract-s04";
import { AgentSchema, ConversationSchema, ListAgentsResponseSchema } from "../../src/schemas";

describe("checkSchema", () => {
  test("surfaces unmodeled additive fields on top-level objects and array items", () => {
    const result = checkSchema("/v0/agents?limit=25", ListAgentsResponseSchema, {
      agents: [
        {
          id: "agent_123",
          status: "FINISHED",
          source: { repository: "github.com/acme/repo" },
          createdAt: "2026-04-01T10:00:00Z",
          extraField: "observed-live",
        },
      ],
      nextCursor: "cursor_123",
      extraTopLevel: true,
    });

    expect(result.ok).toBe(true);
    expect(result.zodIssues).toBeUndefined();
    expect(result.unmodeledFields).toEqual(["agents[].extraField", "extraTopLevel"]);
  });

  test("returns zod issue paths when schema validation fails", () => {
    const result = checkSchema("/v0/agents/{id}/conversation", ConversationSchema, {
      id: "conversation_123",
      messages: [{ id: "msg_1", type: "assistant_message", text: 123 }],
    });

    expect(result.ok).toBe(false);
    expect(result.unmodeledFields).toBeUndefined();
    expect(result.zodIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "messages.0.text",
        }),
      ]),
    );
  });

  test("prefers a finished agent for per-agent probing when one is available", () => {
    const agentId = selectProbeAgentId({
      agents: [
        { id: "agent_expired", status: "EXPIRED" },
        { id: "agent_finished", status: "FINISHED" },
        { id: "agent_running", status: "RUNNING" },
      ],
    });

    expect(agentId).toBe("agent_finished");
  });

  test("does not report additive fields that are already modeled in AgentSchema", () => {
    const result = checkSchema("/v0/agents/{id}", AgentSchema, {
      id: "agent_789",
      status: "FINISHED",
      source: {
        repository: "github.com/acme/repo",
        ref: "main",
        prUrl: "https://github.com/acme/repo/pull/1",
      },
      target: {
        autoCreatePr: true,
        branchName: "feat/live-contract",
        url: "https://github.com/acme/repo/tree/feat/live-contract",
        prUrl: "https://github.com/acme/repo/pull/2",
      },
      summary: "done",
      filesChanged: 4,
      linesAdded: 10,
      linesRemoved: 2,
      createdAt: "2026-04-01T10:00:00Z",
    });

    expect(result.ok).toBe(true);
    expect(result.unmodeledFields).toBeUndefined();
  });
});
