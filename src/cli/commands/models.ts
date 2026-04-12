import type { Command } from "commander";
import type { CursorAgents } from "../../index";
import { exitCodeForError, printError, printResult } from "../output";

export function registerModelsCommands(program: Command, getClient: () => CursorAgents) {
  program
    .command("models")
    .description("List available models")
    .action(async () => {
      const json = program.opts().json;
      try {
        const result = await getClient().models();
        if (json) {
          printResult(result, true);
        } else {
          for (const m of result.models) {
            process.stdout.write(`${m}\n`);
          }
        }
      } catch (err) {
        printError(err, json);
        process.exit(exitCodeForError(err));
      }
    });

  program
    .command("repos")
    .description("List accessible repositories")
    .action(async () => {
      const json = program.opts().json;
      try {
        const result = await getClient().repositories();
        if (json) {
          printResult(result, true);
        } else {
          for (const r of result.repositories) {
            process.stdout.write(`${r.owner}/${r.name}  ${r.repository}\n`);
          }
        }
      } catch (err) {
        printError(err, json);
        process.exit(exitCodeForError(err));
      }
    });
}
