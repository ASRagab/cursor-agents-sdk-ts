import { describe, expect, test } from "bun:test";
import {
  AgentSchema,
  ArtifactSchema,
  ConversationSchema,
  CreateAgentRequestSchema,
  CreateAgentResponseSchema,
  ImageSchema,
  MeResponseSchema,
  ModelsResponseSchema,
  RepositoriesResponseSchema,
  WebhookSchema,
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
      target: {
        autoCreatePr: true,
        branchName: "feat/test",
        url: "https://cursor.com/agents?id=agent_456",
        prUrl: "https://github.com/foo/bar/pull/99",
      },
      summary: "Fixed the bug",
      createdAt: "2026-04-01T10:00:00Z",
    };
    const result = AgentSchema.parse(data);
    expect(result.name).toBe("my-agent");
    expect(result.summary).toBe("Fixed the bug");
    expect(result.target?.autoCreatePr).toBe(true);
    expect(result.target?.url).toBe("https://cursor.com/agents?id=agent_456");
    expect(result.target?.prUrl).toBe("https://github.com/foo/bar/pull/99");
  });

  test("parses agent with promoted additive fields", () => {
    const data = {
      id: "agent_789",
      status: "FINISHED",
      source: {
        repository: "https://github.com/foo/bar",
        ref: "main",
        prUrl: "https://github.com/o/r/pull/1",
      },
      target: {
        autoCreatePr: true,
        branchName: "feat/additive-fields",
        url: "https://github.com/o/r/tree/feat/additive-fields",
        prUrl: "https://github.com/o/r/pull/2",
      },
      summary: "Added contract fields",
      filesChanged: 3,
      linesAdded: 10,
      linesRemoved: 2,
      createdAt: "2026-04-01T10:00:00Z",
    };

    const result = AgentSchema.parse(data);

    expect(result.filesChanged).toBe(3);
    expect(result.linesAdded).toBe(10);
    expect(result.linesRemoved).toBe(2);
    expect(result.source.prUrl).toBe("https://github.com/o/r/pull/1");
    expect(result.target?.url).toBe("https://github.com/o/r/tree/feat/additive-fields");
    expect(result.target?.prUrl).toBe("https://github.com/o/r/pull/2");
  });

  test("leaves promoted additive fields undefined when absent", () => {
    const data = {
      id: "agent_790",
      status: "RUNNING",
      source: { repository: "https://github.com/foo/bar" },
      target: { autoCreatePr: false },
      createdAt: "2026-04-01T10:00:00Z",
    };

    const result = AgentSchema.parse(data);

    expect(result.filesChanged).toBeUndefined();
    expect(result.linesAdded).toBeUndefined();
    expect(result.linesRemoved).toBeUndefined();
    expect(result.source.prUrl).toBeUndefined();
    expect(result.target?.url).toBeUndefined();
    expect(result.target?.prUrl).toBeUndefined();
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

  test("accepts optional webhook", () => {
    const data = {
      prompt: { text: "Do the thing" },
      source: { repository: "https://github.com/foo/bar" },
      webhook: {
        url: "https://example.com/hook",
        secret: "0123456789abcdef0123456789abcdef",
      },
    };
    const result = CreateAgentRequestSchema.parse(data);
    expect(result.webhook?.url).toBe("https://example.com/hook");
    expect(result.webhook?.secret).toBe("0123456789abcdef0123456789abcdef");
  });
});

describe("CreateAgentResponseSchema", () => {
  test("parses response with target", () => {
    const data = {
      id: "bc_abc123",
      name: "Add README",
      status: "CREATING",
      source: { repository: "https://github.com/foo/bar", ref: "main" },
      target: {
        branchName: "feature/add-readme",
        url: "https://cursor.com/agents?id=bc_abc123",
        prUrl: "https://github.com/foo/bar/pull/123",
        autoCreatePr: true,
        openAsCursorGithubApp: false,
        skipReviewerRequest: false,
      },
      createdAt: "2026-04-01T10:30:00Z",
    };
    const result = CreateAgentResponseSchema.parse(data);
    expect(result.target?.branchName).toBe("feature/add-readme");
    expect(result.target?.prUrl).toBe("https://github.com/foo/bar/pull/123");
  });

  test("parses response without target", () => {
    const data = {
      id: "bc_abc123",
      status: "CREATING",
      source: { repository: "https://github.com/foo/bar" },
      createdAt: "2026-04-01T10:30:00Z",
    };
    const result = CreateAgentResponseSchema.parse(data);
    expect(result.id).toBe("bc_abc123");
    expect(result.target).toBeUndefined();
  });
});

describe("WebhookSchema", () => {
  test("requires url", () => {
    expect(() => WebhookSchema.parse({})).toThrow();
  });

  test("accepts url-only webhook", () => {
    const result = WebhookSchema.parse({ url: "https://example.com/hook" });
    expect(result.url).toBe("https://example.com/hook");
    expect(result.secret).toBeUndefined();
  });

  test("rejects secret shorter than 32 chars", () => {
    expect(() =>
      WebhookSchema.parse({ url: "https://example.com/hook", secret: "too-short" }),
    ).toThrow();
  });

  test("accepts 32-char secret", () => {
    const secret = "x".repeat(32);
    const result = WebhookSchema.parse({ url: "https://example.com/hook", secret });
    expect(result.secret).toBe(secret);
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
    const data = { models: ["composer-2", "claude-opus-4-7-thinking-high"] };
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
          repository: "https://github.com/ASRagab/cursor-agents-sdk-ts",
        },
      ],
    };
    const result = RepositoriesResponseSchema.parse(data);
    expect(result.repositories[0].owner).toBe("ASRagab");
    expect(result.repositories[0].repository).toBe(
      "https://github.com/ASRagab/cursor-agents-sdk-ts",
    );
  });
});
