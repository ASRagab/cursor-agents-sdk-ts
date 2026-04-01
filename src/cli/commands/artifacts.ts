import { writeFileSync } from "node:fs";
import { basename } from "node:path";
import type { Command } from "commander";
import type { CursorAgents } from "../../index";
import { exitCodeForError, printError, printResult } from "../output";

export function registerArtifactsCommands(program: Command, getClient: () => CursorAgents) {
  program
    .command("artifacts")
    .description("List agent artifacts")
    .argument("<agent-id>", "Agent ID")
    .action(async (agentId) => {
      const json = program.opts().json;
      try {
        const result = await getClient().agents.artifacts.list(agentId);
        if (json) {
          printResult(result, true);
        } else {
          if (result.artifacts.length === 0) {
            process.stdout.write("No artifacts found.\n");
          } else {
            for (const a of result.artifacts) {
              const size =
                a.sizeBytes >= 1024 ? `${(a.sizeBytes / 1024).toFixed(1)}KB` : `${a.sizeBytes}B`;
              process.stdout.write(`${a.absolutePath}  ${size}  ${a.updatedAt}\n`);
            }
          }
        }
      } catch (err) {
        printError(err, json);
        process.exit(exitCodeForError(err));
      }
    });

  program
    .command("download")
    .description("Download an artifact")
    .argument("<agent-id>", "Agent ID")
    .argument("<artifact-path>", "Absolute artifact path")
    .option("--output <path>", "Local output path")
    .action(async (agentId, artifactPath, opts) => {
      const json = program.opts().json;
      try {
        const result = await getClient().agents.artifacts.downloadUrl(agentId, artifactPath);

        const response = await fetch(result.url);
        if (!response.ok) {
          throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        }

        const outputPath = opts.output ?? basename(artifactPath);
        const buffer = Buffer.from(await response.arrayBuffer());
        writeFileSync(outputPath, buffer);

        if (json) {
          printResult({ path: outputPath, size: buffer.length }, true);
        } else {
          process.stdout.write(`Downloaded to ${outputPath} (${buffer.length} bytes)\n`);
        }
      } catch (err) {
        printError(err, json);
        process.exit(exitCodeForError(err));
      }
    });
}
