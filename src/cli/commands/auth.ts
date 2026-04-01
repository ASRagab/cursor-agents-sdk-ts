import type { Command } from "commander";
import type { CursorAgents } from "../../index";
import { exitCodeForError, printError, printResult } from "../output";

export function registerAuthCommands(program: Command, getClient: () => CursorAgents) {
  const auth = program.command("auth").description("Authentication commands");

  auth
    .command("whoami")
    .description("Show API key info")
    .action(async () => {
      const json = program.opts().json;
      try {
        const result = await getClient().me();
        if (json) {
          printResult(result, true);
        } else {
          process.stdout.write(`Key: ${result.apiKeyName}\n`);
          process.stdout.write(`Created: ${result.createdAt}\n`);
          if (result.userEmail) process.stdout.write(`Email: ${result.userEmail}\n`);
        }
      } catch (err) {
        printError(err, json);
        process.exit(exitCodeForError(err));
      }
    });
}
