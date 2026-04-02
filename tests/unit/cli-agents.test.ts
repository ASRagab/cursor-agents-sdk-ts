import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import {
  getModelHint,
  normalizeRepositoryInput,
  registerAgentsCommands,
  suggestModels,
  validateCreateOptions,
} from "../../src/cli/commands/agents";
import { CursorAgentsError } from "../../src/errors";

describe("normalizeRepositoryInput", () => {
  test("normalizes owner/repo shorthand", () => {
    expect(normalizeRepositoryInput("ASRagab/cursor-agents-sdk-ts")).toBe(
      "https://github.com/ASRagab/cursor-agents-sdk-ts",
    );
  });

  test("normalizes owner/repo.git shorthand", () => {
    expect(normalizeRepositoryInput("ASRagab/cursor-agents-sdk-ts.git")).toBe(
      "https://github.com/ASRagab/cursor-agents-sdk-ts",
    );
  });

  test("normalizes github urls and strips .git", () => {
    expect(normalizeRepositoryInput("https://github.com/ASRagab/cursor-agents-sdk-ts.git")).toBe(
      "https://github.com/ASRagab/cursor-agents-sdk-ts",
    );
  });

  test("normalizes github ssh urls", () => {
    expect(normalizeRepositoryInput("git@github.com:ASRagab/cursor-agents-sdk-ts.git")).toBe(
      "https://github.com/ASRagab/cursor-agents-sdk-ts",
    );
  });
});

describe("create option validation", () => {
  test("rejects --auto-branch without --pr", () => {
    expect(() =>
      validateCreateOptions({ repo: "owner/repo", prompt: "test", autoBranch: true }),
    ).toThrow(CursorAgentsError);
    try {
      validateCreateOptions({ repo: "owner/repo", prompt: "test", autoBranch: true });
    } catch (error) {
      const createError = error as CursorAgentsError;
      expect(createError.message).toContain("--auto-branch can only be used with --pr");
      expect(createError.details).toEqual({
        hint: "--auto-branch only applies when the source is an existing pull request.",
        nextStep:
          "Use --pr <pull-request-url> with --auto-branch, or remove --auto-branch and use --repo/--ref for repository-based runs.",
      });
    }
  });

  test("accepts shorthand github repos", () => {
    expect(() => validateCreateOptions({ repo: "owner/repo", prompt: "test" })).not.toThrow();
  });

  test("rejects --repo with --pr", () => {
    expect(() =>
      validateCreateOptions({
        repo: "owner/repo",
        pr: "https://github.com/o/r/pull/1",
        prompt: "text",
      }),
    ).toThrow(CursorAgentsError);
    try {
      validateCreateOptions({
        repo: "owner/repo",
        pr: "https://github.com/o/r/pull/1",
        prompt: "text",
      });
    } catch (error) {
      const e = error as CursorAgentsError;
      expect(e.message).toContain("--repo and --pr are mutually exclusive");
      expect(e.details).toEqual({
        hint: "--repo starts from a repository branch. --pr starts from an existing pull request.",
        nextStep:
          "Pick exactly one source mode: use --repo <owner/repo> for repository-based runs or --pr <url> for PR-based runs.",
      });
    }
  });

  test("returns structured details for invalid repo input", () => {
    expect(() => validateCreateOptions({ repo: "not a repo", prompt: "test" })).toThrow(
      CursorAgentsError,
    );
    try {
      validateCreateOptions({ repo: "not a repo", prompt: "test" });
    } catch (error) {
      const createError = error as CursorAgentsError;
      expect(createError.message).toContain("Invalid --repo value");
      expect(createError.details).toEqual({
        hint: 'Repository "not a repo" could not be normalized to a supported GitHub repository URL.',
        nextStep:
          "Pass --repo as owner/repo or https://github.com/owner/repo. You can keep or omit the optional .git suffix.",
      });
    }
  });

  test("rejects when neither --repo nor --pr is provided", () => {
    expect(() => validateCreateOptions({ prompt: "test" })).toThrow(CursorAgentsError);
    try {
      validateCreateOptions({ prompt: "test" });
    } catch (error) {
      const e = error as CursorAgentsError;
      expect(e.message).toContain("Either --repo or --pr is required");
      expect(e.details?.nextStep).toBeTruthy();
    }
  });

  test("rejects when neither --prompt nor --prompt-file is provided", () => {
    expect(() => validateCreateOptions({ repo: "owner/repo" })).toThrow(CursorAgentsError);
    try {
      validateCreateOptions({ repo: "owner/repo" });
    } catch (error) {
      const e = error as CursorAgentsError;
      expect(e.message).toContain("Either --prompt or --prompt-file is required");
      expect(e.details?.nextStep).toBeTruthy();
    }
  });

  test("rejects --prompt with --prompt-file", () => {
    expect(() =>
      validateCreateOptions({ repo: "owner/repo", prompt: "text", promptFile: "file.md" }),
    ).toThrow(CursorAgentsError);
    try {
      validateCreateOptions({ repo: "owner/repo", prompt: "text", promptFile: "file.md" });
    } catch (error) {
      const e = error as CursorAgentsError;
      expect(e.message).toContain("mutually exclusive");
      expect(e.details?.hint).toContain("Both --prompt and --prompt-file");
    }
  });

  test("rejects --watch with --wait", () => {
    expect(() =>
      validateCreateOptions({ repo: "owner/repo", prompt: "text", watch: true, wait: true }),
    ).toThrow(CursorAgentsError);
    try {
      validateCreateOptions({ repo: "owner/repo", prompt: "text", watch: true, wait: true });
    } catch (error) {
      const e = error as CursorAgentsError;
      expect(e.message).toContain("mutually exclusive");
      expect(e.details?.hint).toContain("--watch");
      expect(e.details?.hint).toContain("--wait");
    }
  });

  test("rejects --branch-name with --auto-branch", () => {
    expect(() =>
      validateCreateOptions({
        pr: "https://github.com/o/r/pull/1",
        prompt: "text",
        branchName: "fix",
        autoBranch: true,
      }),
    ).toThrow(CursorAgentsError);
    try {
      validateCreateOptions({
        pr: "https://github.com/o/r/pull/1",
        prompt: "text",
        branchName: "fix",
        autoBranch: true,
      });
    } catch (error) {
      const e = error as CursorAgentsError;
      expect(e.message).toContain("mutually exclusive");
    }
  });

  test("rejects --ref with --pr", () => {
    expect(() =>
      validateCreateOptions({
        pr: "https://github.com/o/r/pull/1",
        prompt: "text",
        ref: "main",
      }),
    ).toThrow(CursorAgentsError);
    try {
      validateCreateOptions({
        pr: "https://github.com/o/r/pull/1",
        prompt: "text",
        ref: "main",
      });
    } catch (error) {
      const e = error as CursorAgentsError;
      expect(e.message).toContain("--ref cannot be used with --pr");
    }
  });

  test("rejects --auto-pr with --pr", () => {
    expect(() =>
      validateCreateOptions({
        pr: "https://github.com/o/r/pull/1",
        prompt: "text",
        autoPr: true,
      }),
    ).toThrow(CursorAgentsError);
    try {
      validateCreateOptions({
        pr: "https://github.com/o/r/pull/1",
        prompt: "text",
        autoPr: true,
      });
    } catch (error) {
      const e = error as CursorAgentsError;
      expect(e.message).toContain("--auto-pr cannot be used with --pr");
    }
  });

  test("accepts valid flag combinations without throwing", () => {
    expect(() =>
      validateCreateOptions({ repo: "owner/repo", prompt: "text", autoPr: true }),
    ).not.toThrow();
    expect(() =>
      validateCreateOptions({
        pr: "https://github.com/o/r/pull/1",
        prompt: "text",
        autoBranch: true,
      }),
    ).not.toThrow();
    expect(() =>
      validateCreateOptions({ repo: "owner/repo", promptFile: "file.md", wait: true }),
    ).not.toThrow();
    expect(() =>
      validateCreateOptions({ repo: "owner/repo", prompt: "text", watch: true }),
    ).not.toThrow();
    expect(() =>
      validateCreateOptions({
        pr: "https://github.com/o/r/pull/1",
        prompt: "text",
        branchName: "fix",
      }),
    ).not.toThrow();
    expect(() => validateCreateOptions({ repo: "owner/repo", prompt: "text" })).not.toThrow();
    expect(() =>
      validateCreateOptions({ pr: "https://github.com/o/r/pull/1", prompt: "text" }),
    ).not.toThrow();
  });
});

describe("model suggestions", () => {
  test("suggests exact family variants first", () => {
    expect(
      suggestModels("gpt-5.4", [
        "gpt-5.3-codex-high",
        "gpt-5.4-high",
        "gpt-5.4-high-fast",
        "gpt-5.4-xhigh-fast",
      ]),
    ).toEqual(["gpt-5.4-high", "gpt-5.4-high-fast", "gpt-5.4-xhigh-fast"]);
  });

  test("falls back to partial matches", () => {
    expect(
      suggestModels("claude-4.6", [
        "gpt-5.4-high",
        "claude-4.6-opus-high-thinking",
        "claude-4.6-opus-high-thinking-fast",
      ]),
    ).toEqual(["claude-4.6-opus-high-thinking", "claude-4.6-opus-high-thinking-fast"]);
  });

  test("returns high-confidence structured hints for family matches", () => {
    expect(
      getModelHint("gpt-5.4", [
        "gpt-5.4-high",
        "gpt-5.4-high-fast",
        "gpt-5.4-xhigh-fast",
        "claude-4.6-opus-high-thinking",
      ]),
    ).toEqual({
      hint: 'Model "gpt-5.4" is not available.',
      suggestions: ["gpt-5.4-high", "gpt-5.4-high-fast", "gpt-5.4-xhigh-fast"],
      suggestionsConfidence: "high",
      nextStep:
        'Use one of the suggested model ids or run "cursor-agents models" to see all supported models.',
    });
  });

  test("returns low-confidence structured hints without suggestions", () => {
    expect(
      getModelHint("gemini-3.1-pro", [
        "gpt-5.4-high",
        "gpt-5.4-high-fast",
        "claude-4.6-opus-high-thinking",
      ]),
    ).toEqual({
      hint: 'Model "gemini-3.1-pro" is not available.',
      suggestions: [],
      suggestionsConfidence: "low",
      nextStep: 'Run "cursor-agents models" to list supported model ids.',
    });
  });
});

describe("create help text", () => {
  test("explains source and branch semantics", () => {
    const program = new Command();
    registerAgentsCommands(program, () => {
      throw new Error("not used");
    });

    const createCommand = program.commands.find((command) => command.name() === "create");
    const help = createCommand?.helpInformation() ?? "";

    expect(help).toContain("Create a new agent from a repository or existing pull request");
    expect(help).toContain("Start from a repository");
    expect(help).toContain("Start from an existing pull request URL");
    expect(help).toContain("Open a pull request automatically after the run");
    expect(help).toContain("Create/select a branch automatically for PR follow-up");
  });
});
