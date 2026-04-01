import { readFileSync } from "node:fs";
import type { Command } from "commander";
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
    process.stderr.write("Error: --prompt or --prompt-file is required\n");
    process.exit(1);
  }
  return { text, images: collectImages(imagePaths) };
}

export function registerAgentsCommands(program: Command, getClient: () => CursorAgents) {
  program
    .command("create")
    .description("Create a new agent")
    .option("--repo <url>", "Repository URL")
    .option("--ref <branch>", "Branch or ref")
    .option("--pr <url>", "Pull request URL")
    .option("--prompt <text>", "Prompt text")
    .option("--prompt-file <path>", "Read prompt from file")
    .option("--image <path...>", "Image file paths (base64 encoded)")
    .option("--model <id>", "Model ID")
    .option("--branch-name <name>", "Branch name for PR")
    .option("--auto-pr", "Auto-create PR")
    .option("--as-app", "Open as Cursor GitHub App")
    .option("--auto-branch", "Auto-create branch (PR mode)")
    .option("--wait", "Wait for agent to complete")
    .option("--watch", "Watch conversation messages until complete")
    .action(async (opts) => {
      const json = program.opts().json;
      const quiet = program.opts().quiet;
      try {
        const prompt = resolvePrompt(opts.prompt, opts.promptFile, opts.image);

        let source: { repository: string; ref?: string } | { prUrl: string };
        if (opts.pr) {
          source = { prUrl: opts.pr };
        } else if (opts.repo) {
          source = { repository: opts.repo, ref: opts.ref };
        } else {
          process.stderr.write("Error: --repo or --pr is required\n");
          process.exit(1);
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
        printError(err, json);
        process.exit(exitCodeForError(err));
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
    .description("Stop a running agent (cannot be resumed)")
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
