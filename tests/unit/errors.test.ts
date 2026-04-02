import { describe, expect, test } from "bun:test";
import { CursorAgentsError, errorCodeFromStatus } from "../../src/errors";

describe("CursorAgentsError", () => {
  test("constructs with code, status, message", () => {
    const err = new CursorAgentsError({
      code: "not_found",
      status: 404,
      message: "Agent not found",
    });
    expect(err.code).toBe("not_found");
    expect(err.status).toBe(404);
    expect(err.message).toBe("Agent not found");
    expect(err.name).toBe("CursorAgentsError");
    expect(err.raw).toBeUndefined();
    expect(err.details).toBeUndefined();
    expect(err).toBeInstanceOf(Error);
  });

  test("preserves raw response data", () => {
    const raw = { error: { message: "oops", code: "bad_request" } };
    const err = new CursorAgentsError({
      code: "bad_request",
      status: 400,
      message: "oops",
      raw,
    });
    expect(err.raw).toEqual(raw);
  });

  test("preserves structured details", () => {
    const err = new CursorAgentsError({
      code: "bad_request",
      status: 400,
      message: "Bad Request",
      details: {
        hint: 'Model "gpt-5.4" is not available.',
        suggestions: ["gpt-5.4-high"],
        suggestionsConfidence: "high",
        nextStep: 'Run "cursor-agents models" to list supported model ids.',
      },
    });

    expect(err.details).toEqual({
      hint: 'Model "gpt-5.4" is not available.',
      suggestions: ["gpt-5.4-high"],
      suggestionsConfidence: "high",
      nextStep: 'Run "cursor-agents models" to list supported model ids.',
    });
  });
});

describe("errorCodeFromStatus", () => {
  test.each([
    [400, "bad_request"],
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [409, "conflict"],
    [429, "rate_limited"],
    [500, "internal_error"],
  ] as const)("maps %d to %s", (status, code) => {
    expect(errorCodeFromStatus(status)).toBe(code);
  });

  test("returns unknown_error for unmapped status", () => {
    expect(errorCodeFromStatus(418)).toBe("unknown_error");
    expect(errorCodeFromStatus(503)).toBe("unknown_error");
  });
});
