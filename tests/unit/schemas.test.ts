import { describe, expect, test } from "bun:test";
import {
  AgentSchema,
  ArtifactSchema,
  ConversationSchema,
  CreateAgentRequestSchema,
  ImageSchema,
  MeResponseSchema,
  ModelsResponseSchema,
  RepositoriesResponseSchema,
} from "../../src/schemas";

describe("AgentSchema", () => {
  test("parses valid agent", () => {
    const data = {
      id: "agent_123",
      status: "RUNNING",
      source: { repository: "https://github.com/foo/bar" },
      createdAt: "2026-04-01T10:00:00Z",
    };
    const result = AgentSchema.parse(data);
    expect(result.id).toBe("agent_123");
    expect(result.status).toBe("RUNNING");
  });

  test("parses agent with optional fields", () => {
    const data = {
      id: "agent_456",
      name: "my-agent",
      status: "FINISHED",
      source: { repository: "https://github.com/foo/bar", ref: "main" },
      target: { autoCreatePr: true, branchName: "feat/test" },
      summary: "Fixed the bug",
      createdAt: "2026-04-01T10:00:00Z",
    };
    const result = AgentSchema.parse(data);
    expect(result.name).toBe("my-agent");
    expect(result.summary).toBe("Fixed the bug");
    expect(result.target?.autoCreatePr).toBe(true);
  });

  test("rejects invalid status", () => {
    const data = {
      id: "agent_123",
      status: "INVALID",
      source: { repository: "https://github.com/foo/bar" },
      createdAt: "2026-04-01T10:00:00Z",
    };
    expect(() => AgentSchema.parse(data)).toThrow();
  });
});

describe("CreateAgentRequestSchema", () => {
  test("accepts repository source", () => {
    const data = {
      prompt: { text: "Fix the tests" },
      source: { repository: "https://github.com/foo/bar", ref: "main" },
    };
    const result = CreateAgentRequestSchema.parse(data);
    expect(result.prompt.text).toBe("Fix the tests");
  });

  test("accepts prUrl source", () => {
    const data = {
      prompt: { text: "Review this PR" },
      source: { prUrl: "https://github.com/foo/bar/pull/1" },
    };
    const result = CreateAgentRequestSchema.parse(data);
    expect(result.source).toHaveProperty("prUrl");
  });

  test("accepts optional model and target", () => {
    const data = {
      prompt: { text: "Do the thing" },
      source: { repository: "https://github.com/foo/bar" },
      model: "claude-4-sonnet",
      target: { autoCreatePr: true },
    };
    const result = CreateAgentRequestSchema.parse(data);
    expect(result.model).toBe("claude-4-sonnet");
  });
});

describe("ImageSchema", () => {
  test("requires data field", () => {
    expect(() => ImageSchema.parse({})).toThrow();
    expect(() => ImageSchema.parse({ data: "" })).toThrow();
  });

  test("accepts valid image", () => {
    const result = ImageSchema.parse({ data: "iVBORw0KGgo=" });
    expect(result.data).toBe("iVBORw0KGgo=");
  });

  test("accepts image with dimension", () => {
    const result = ImageSchema.parse({
      data: "iVBORw0KGgo=",
      dimension: { width: 100, height: 200 },
    });
    expect(result.dimension?.width).toBe(100);
  });
});

describe("ConversationSchema", () => {
  test("parses conversation with messages", () => {
    const data = {
      id: "convo_1",
      messages: [
        { id: "msg_1", type: "user_message", text: "Fix the tests" },
        { id: "msg_2", type: "assistant_message", text: "Done, tests are passing now" },
      ],
    };
    const result = ConversationSchema.parse(data);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].type).toBe("user_message");
  });

  test("rejects invalid message type", () => {
    const data = {
      id: "convo_1",
      messages: [{ id: "msg_1", type: "system_message", text: "nope" }],
    };
    expect(() => ConversationSchema.parse(data)).toThrow();
  });
});

describe("ArtifactSchema", () => {
  test("parses valid artifact", () => {
    const data = {
      absolutePath: "/workspace/src/index.ts",
      sizeBytes: 1234,
      updatedAt: "2026-04-01T10:00:00Z",
    };
    const result = ArtifactSchema.parse(data);
    expect(result.absolutePath).toBe("/workspace/src/index.ts");
    expect(result.sizeBytes).toBe(1234);
  });
});

describe("MeResponseSchema", () => {
  test("parses response with email", () => {
    const data = {
      apiKeyName: "my-key",
      createdAt: "2026-01-01T00:00:00Z",
      userEmail: "test@example.com",
    };
    const result = MeResponseSchema.parse(data);
    expect(result.userEmail).toBe("test@example.com");
  });

  test("parses response without email", () => {
    const data = { apiKeyName: "my-key", createdAt: "2026-01-01T00:00:00Z" };
    const result = MeResponseSchema.parse(data);
    expect(result.userEmail).toBeUndefined();
  });
});

describe("ModelsResponseSchema", () => {
  test("parses models list", () => {
    const data = { models: ["claude-4-sonnet", "gpt-5.2"] };
    const result = ModelsResponseSchema.parse(data);
    expect(result.models).toHaveLength(2);
  });
});

describe("RepositoriesResponseSchema", () => {
  test("parses repositories", () => {
    const data = {
      repositories: [
        {
          owner: "ASRagab",
          name: "cursor-agents-sdk-ts",
          url: "https://github.com/ASRagab/cursor-agents-sdk-ts",
        },
      ],
    };
    const result = RepositoriesResponseSchema.parse(data);
    expect(result.repositories[0].owner).toBe("ASRagab");
  });
});
