import { readFileSync } from "node:fs";
import type { Command } from "commander";
import { CursorAgentsError } from "../../errors";
import type { CursorAgents } from "../../index";
import type { Image } from "../../schemas";
import { exitCodeForError, formatAgent, formatAgentList, printError, printResult } from "../output";

function readPromptFile(path: string): string {
  return readFileSync(path, "utf-8");
}

function readImageAsBase64(path: string): Image {
  const buffer = readFileSync(path);
  return { data: buffer.toString("base64") };
}

function collectImages(imagePaths: string[] | undefined): Image[] | undefined {
  if (!imagePaths || imagePaths.length === 0) return undefined;
  return imagePaths.map(readImageAsBase64);
}

function resolvePrompt(
  promptText: string | undefined,
  promptFile: string | undefined,
  imagePaths: string[] | undefined,
): { text: string; images?: Image[] } {
  let text: string;
  if (promptFile) {
    text = readPromptFile(promptFile);
  } else if (promptText) {
    text = promptText;
  } else {
    // Defensive: validateCreateOptions should catch this before we get here.
    throw new CursorAgentsError({
      code: "bad_request",
      status: 400,
      message: "Either --prompt or --prompt-file is required.",
      details: {
        hint: "--prompt accepts inline text. --prompt-file reads from a file path.",
        nextStep:
          "Use --prompt <text> for inline prompts or --prompt-file <path> for file-based prompts.",
      },
    });
  }
  return { text, images: collectImages(imagePaths) };
}

export function normalizeRepositoryInput(input: string): string {
  const trimmed = input.trim();

  const githubUrlMatch = /^(?:https?:\/\/)?github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(
    trimmed,
  );
  if (githubUrlMatch) {
    const [, owner, repo] = githubUrlMatch;
    return `https://github.com/${owner}/${repo}`;
  }

  const sshMatch = /^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/.exec(trimmed);
  if (sshMatch) {
    const [, owner, repo] = sshMatch;
    return `https://github.com/${owner}/${repo}`;
  }

  const slugMatch = /^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/.exec(trimmed);
  if (slugMatch) {
    const [, owner, repo] = slugMatch;
    return `https://github.com/${owner}/${repo}`;
  }

  return trimmed;
}

export function validateCreateOptions(opts: {
  pr?: string;
  repo?: string;
  ref?: string;
  prompt?: string;
  promptFile?: string;
  autoPr?: boolean;
  autoBranch?: boolean;
  branchName?: string;
  wait?: boolean;
  watch?: boolean;
}) {
  // --- Required fields ---

  if (!opts.repo && !opts.pr) {
    throw new CursorAgentsError({
      code: "bad_request",
      status: 400,
      message: "Either --repo or --pr is required.",
      details: {
        hint: "--repo starts from a repository branch. --pr starts from an existing pull request.",
        nextStep:
          "Use --repo <owner/repo> for repository-based runs or --pr <url> for PR-based runs.",
      },
    });
  }

  if (opts.repo && opts.pr) {
    throw new CursorAgentsError({
      code: "bad_request",
      status: 400,
      message: "--repo and --pr are mutually exclusive.",
      details: {
        hint: "--repo starts from a repository branch. --pr starts from an existing pull request.",
        nextStep:
          "Pick exactly one source mode: use --repo <owner/repo> for repository-based runs or --pr <url> for PR-based runs.",
      },
    });
  }

  if (!opts.prompt && !opts.promptFile) {
    throw new CursorAgentsError({
      code: "bad_request",
      status: 400,
      message: "Either --prompt or --prompt-file is required.",
      details: {
        hint: "--prompt accepts inline text. --prompt-file reads from a file path.",
        nextStep:
          "Use --prompt <text> for inline prompts or --prompt-file <path> for file-based prompts.",
      },
    });
  }

  // --- Mutual-exclusion checks ---

  if (opts.prompt && opts.promptFile) {
    throw new CursorAgentsError({
      code: "bad_request",
      status: 400,
      message: "--prompt and --prompt-file are mutually exclusive.",
      details: {
        hint: "Both --prompt and --prompt-file were provided. The CLI cannot determine which to use.",
        nextStep:
          "Use --prompt for inline text or --prompt-file to read from a file, but not both.",
      },
    });
  }

  if (opts.watch && opts.wait) {
    throw new CursorAgentsError({
      code: "bad_request",
      status: 400,
      message: "--watch and --wait are mutually exclusive.",
      details: {
        hint: "--watch streams conversation messages in real-time. --wait only reports the final agent status.",
        nextStep: "Choose one: --watch for conversation output, or --wait for status-only polling.",
      },
    });
  }

  if (opts.branchName && opts.autoBranch) {
    throw new CursorAgentsError({
      code: "bad_request",
      status: 400,
      message: "--branch-name and --auto-branch are mutually exclusive.",
      details: {
        hint: "--branch-name sets an explicit branch name. --auto-branch lets Cursor choose automatically.",
        nextStep:
          "Use --branch-name <name> to control the branch name, or --auto-branch to let Cursor decide, but not both.",
      },
    });
  }

  // --- Source-mode conflict checks ---

  if (opts.ref && opts.pr) {
    throw new CursorAgentsError({
      code: "bad_request",
      status: 400,
      message:
        "--ref cannot be used with --pr. The pull request already defines the source branch.",
      details: {
        hint: "--ref selects a branch when starting from a repository. When using --pr, the PR's branch is used automatically.",
        nextStep:
          "Remove --ref when using --pr, or switch to --repo with --ref for branch-based runs.",
      },
    });
  }

  if (opts.autoPr && opts.pr) {
    throw new CursorAgentsError({
      code: "bad_request",
      status: 400,
      message: "--auto-pr cannot be used with --pr. A pull request already exists as the source.",
      details: {
        hint: "--auto-pr creates a new pull request after the agent finishes. When starting from --pr, the agent pushes to the existing PR branch instead.",
        nextStep:
          "Remove --auto-pr when using --pr. Use --auto-branch if the agent should work on a follow-up branch.",
      },
    });
  }

  if (opts.autoBranch && !opts.pr) {
    throw new CursorAgentsError({
      code: "bad_request",
      status: 400,
      message:
        "--auto-branch can only be used with --pr. For repository sources, use --repo with --ref and optionally --auto-pr.",
      details: {
        hint: "--auto-branch only applies when the source is an existing pull request.",
        nextStep:
          "Use --pr <pull-request-url> with --auto-branch, or remove --auto-branch and use --repo/--ref for repository-based runs.",
      },
    });
  }

  // --- Repo format validation ---

  if (opts.repo) {
    const normalized = normalizeRepositoryInput(opts.repo);
    const isHttpUrl = /^https?:\/\//.test(normalized);
    if (!isHttpUrl) {
      throw new CursorAgentsError({
        code: "bad_request",
        status: 400,
        message:
          "Invalid --repo value. Use a GitHub URL like https://github.com/owner/repo or shorthand owner/repo.",
        details: {
          hint: `Repository "${opts.repo}" could not be normalized to a supported GitHub repository URL.`,
          nextStep:
            "Pass --repo as owner/repo or https://github.com/owner/repo. You can keep or omit the optional .git suffix.",
        },
      });
    }
  }
}

export function suggestModels(requested: string, available: string[]): string[] {
  const lowerRequested = requested.toLowerCase();

  const exactFamilyMatches = available.filter((model) => {
    const lowerModel = model.toLowerCase();
    return lowerModel === lowerRequested || lowerModel.startsWith(`${lowerRequested}-`);
  });
  if (exactFamilyMatches.length > 0) {
    return exactFamilyMatches;
  }

  const partialMatches = available.filter((model) => model.toLowerCase().includes(lowerRequested));
  return partialMatches.slice(0, 5);
}

export function getModelHint(
  requested: string,
  available: string[],
): {
  hint: string;
  suggestions: string[];
  suggestionsConfidence: "high" | "low";
  nextStep: string;
} {
  const exactFamilyMatches = available.filter((model) =>
    model.toLowerCase().startsWith(`${requested.toLowerCase()}-`),
  );

  if (exactFamilyMatches.length > 0) {
    return {
      hint: `Model "${requested}" is not available.`,
      suggestions: exactFamilyMatches,
      suggestionsConfidence: "high",
      nextStep:
        'Use one of the suggested model ids or run "cursor-agents models" to see all supported models.',
    };
  }

  return {
    hint: `Model "${requested}" is not available.`,
    suggestions: [],
    suggestionsConfidence: "low",
    nextStep: 'Run "cursor-agents models" to list supported model ids.',
  };
}

async function enhanceCreateError(
  err: unknown,
  opts: { model?: string },
  getClient: () => CursorAgents,
): Promise<unknown> {
  if (!(err instanceof CursorAgentsError) || err.code !== "bad_request" || !opts.model) {
    return err;
  }

  try {
    const { models } = await getClient().models();
    if (models.includes(opts.model)) {
      return err;
    }

    const details = getModelHint(opts.model, models);

    return new CursorAgentsError({
      code: err.code,
      status: err.status,
      raw: err.raw,
      message: err.message,
      details,
    });
  } catch {
    return err;
  }
}

export function registerAgentsCommands(program: Command, getClient: () => CursorAgents) {
  program
    .command("create")
    .description("Create a new agent from a repository or existing pull request")
    .option("--repo <url>", "Start from a repository (owner/repo or GitHub URL)")
    .option("--ref <branch>", "Repository branch or ref to start from")
    .option("--pr <url>", "Start from an existing pull request URL")
    .option("--prompt <text>", "Prompt text")
    .option("--prompt-file <path>", "Read prompt from file")
    .option("--image <path...>", "Image file paths (base64 encoded)")
    .option("--model <id>", "Model ID")
    .option("--branch-name <name>", "Branch name to use for the agent's changes")
    .option("--auto-pr", "Open a pull request automatically after the run")
    .option("--as-app", "Open as Cursor GitHub App")
    .option("--auto-branch", "Create/select a branch automatically for PR follow-up work")
    .option("--wait", "Wait for agent to complete")
    .option("--watch", "Watch conversation messages until complete")
    .addHelpText(
      "after",
      `
Examples:
  # Start from a repo/ref and open a PR when done
  cursor-agents create --repo owner/repo --ref main --prompt "Fix the tests" --auto-pr

  # Start from an existing PR and let Cursor choose the follow-up branch
  cursor-agents create --pr https://github.com/owner/repo/pull/42 --prompt "Address review feedback" --auto-branch
`,
    )
    .action(async (opts) => {
      const json = program.opts().json;
      const quiet = program.opts().quiet;
      try {
        validateCreateOptions(opts);
        const prompt = resolvePrompt(opts.prompt, opts.promptFile, opts.image);

        let source: { repository: string; ref?: string } | { prUrl: string };
        if (opts.pr) {
          source = { prUrl: opts.pr };
        } else {
          source = { repository: normalizeRepositoryInput(opts.repo), ref: opts.ref };
        }

        const target: Record<string, unknown> = {};
        if (opts.autoPr) target.autoCreatePr = true;
        if (opts.asApp) target.openAsCursorGithubApp = true;
        if (opts.branchName) target.branchName = opts.branchName;
        if (opts.autoBranch) target.autoBranch = true;

        const result = await getClient().agents.create({
          prompt,
          source,
          model: opts.model,
          target: Object.keys(target).length > 0 ? target : undefined,
        });

        if (!quiet) {
          printResult(json ? result : formatAgent(result), json);
        }

        if (opts.watch) {
          const agent = await getClient().agents.watch(result.id, {
            onMessage: (msg) => {
              if (!json) {
                const prefix = msg.type === "user_message" ? "USER" : "AGENT";
                process.stderr.write(`[${prefix}] ${msg.text}\n`);
              }
            },
            onStatus: (a) => {
              if (!quiet && !json) {
                process.stderr.write(`Status: ${a.status}\n`);
              }
            },
          });
          printResult(json ? agent : formatAgent(agent), json);
        } else if (opts.wait) {
          const agent = await getClient().agents.waitFor(result.id, {
            onStatus: (a) => {
              if (!quiet && !json) {
                process.stderr.write(`Status: ${a.status}\n`);
              }
            },
          });
          printResult(json ? agent : formatAgent(agent), json);
        }
      } catch (err) {
        const enhanced = await enhanceCreateError(err, opts, getClient);
        printError(enhanced, json);
        process.exit(exitCodeForError(enhanced));
      }
    });

  program
    .command("list")
    .description("List agents")
    .option("--limit <n>", "Max results", Number.parseInt)
    .option("--cursor <token>", "Pagination cursor")
    .option("--pr <url>", "Filter by PR URL")
    .action(async (opts) => {
      const json = program.opts().json;
      try {
        const result = await getClient().agents.list({
          limit: opts.limit,
          cursor: opts.cursor,
          prUrl: opts.pr,
        });
        if (json) {
          printResult(result, true);
        } else {
          process.stdout.write(`${formatAgentList(result.agents, result.nextCursor)}\n`);
        }
      } catch (err) {
        printError(err, json);
        process.exit(exitCodeForError(err));
      }
    });

  program
    .command("status")
    .description("Get agent status")
    .argument("<agent-id>", "Agent ID")
    .action(async (agentId) => {
      const json = program.opts().json;
      try {
        const result = await getClient().agents.get(agentId);
        printResult(json ? result : formatAgent(result), json);
      } catch (err) {
        printError(err, json);
        process.exit(exitCodeForError(err));
      }
    });

  program
    .command("wait")
    .description("Wait for agent to reach terminal state")
    .argument("<agent-id>", "Agent ID")
    .option("--interval <ms>", "Poll interval in ms", Number.parseInt)
    .option("--timeout <ms>", "Timeout in ms", Number.parseInt)
    .action(async (agentId, opts) => {
      const json = program.opts().json;
      const quiet = program.opts().quiet;
      try {
        const result = await getClient().agents.waitFor(agentId, {
          intervalMs: opts.interval,
          timeoutMs: opts.timeout,
          onStatus: (a) => {
            if (!quiet && !json) {
              process.stderr.write(`Status: ${a.status}\n`);
            }
          },
        });
        printResult(json ? result : formatAgent(result), json);
      } catch (err) {
        printError(err, json);
        process.exit(exitCodeForError(err));
      }
    });

  program
    .command("watch")
    .description("Watch conversation messages until agent completes")
    .argument("<agent-id>", "Agent ID")
    .option("--interval <ms>", "Poll interval in ms", Number.parseInt)
    .action(async (agentId, opts) => {
      const json = program.opts().json;
      const quiet = program.opts().quiet;
      try {
        const result = await getClient().agents.watch(agentId, {
          intervalMs: opts.interval,
          onMessage: (msg) => {
            if (json) {
              process.stdout.write(`${JSON.stringify(msg)}\n`);
            } else {
              const prefix = msg.type === "user_message" ? "USER" : "AGENT";
              process.stdout.write(`[${prefix}] ${msg.text}\n`);
            }
          },
          onStatus: (a) => {
            if (!quiet && !json) {
              process.stderr.write(`Status: ${a.status}\n`);
            }
          },
        });
        if (!json) {
          process.stdout.write(`\n${formatAgent(result)}\n`);
        }
      } catch (err) {
        printError(err, json);
        process.exit(exitCodeForError(err));
      }
    });

  program
    .command("followup")
    .description("Send followup instruction to agent")
    .argument("<agent-id>", "Agent ID")
    .option("--prompt <text>", "Followup prompt text")
    .option("--prompt-file <path>", "Read prompt from file")
    .option("--image <path...>", "Image file paths")
    .action(async (agentId, opts) => {
      const json = program.opts().json;
      try {
        const prompt = resolvePrompt(opts.prompt, opts.promptFile, opts.image);
        const result = await getClient().agents.followup(agentId, { prompt });
        printResult(result, json);
      } catch (err) {
        printError(err, json);
        process.exit(exitCodeForError(err));
      }
    });

  program
    .command("stop")
    .description("Pause a running agent (send a followup to resume)")
    .argument("<agent-id>", "Agent ID")
    .action(async (agentId) => {
      const json = program.opts().json;
      try {
        const result = await getClient().agents.stop(agentId);
        printResult(json ? result : `Stopped agent ${result.id}`, json);
      } catch (err) {
        printError(err, json);
        process.exit(exitCodeForError(err));
      }
    });

  program
    .command("delete")
    .description("Delete an agent (permanent)")
    .argument("<agent-id>", "Agent ID")
    .action(async (agentId) => {
      const json = program.opts().json;
      try {
        const result = await getClient().agents.delete(agentId);
        printResult(json ? result : `Deleted agent ${result.id}`, json);
      } catch (err) {
        printError(err, json);
        process.exit(exitCodeForError(err));
      }
    });

  program
    .command("conversation")
    .description("Get agent conversation history")
    .argument("<agent-id>", "Agent ID")
    .action(async (agentId) => {
      const json = program.opts().json;
      try {
        const result = await getClient().agents.conversation(agentId);
        if (json) {
          printResult(result, true);
        } else {
          for (const msg of result.messages) {
            const prefix = msg.type === "user_message" ? "USER" : "AGENT";
            process.stdout.write(`[${prefix}] ${msg.text}\n\n`);
          }
        }
      } catch (err) {
        printError(err, json);
        process.exit(exitCodeForError(err));
      }
    });
}
