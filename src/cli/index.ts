import { Command } from "commander";
import { CursorAgents, VERSION } from "../index";
import { registerAgentsCommands } from "./commands/agents";
import { registerArtifactsCommands } from "./commands/artifacts";
import { registerAuthCommands } from "./commands/auth";
import { registerModelsCommands } from "./commands/models";

const program = new Command();

program
  .name("cursor-agents")
  .description("CLI for the Cursor Cloud Agents API")
  .version(VERSION)
  .option("--json", "Output structured JSON")
  .option("--api-key <key>", "API key (overrides CURSOR_API_KEY env)")
  .option("--base-url <url>", "Override API base URL")
  .option("--quiet", "Suppress non-essential output");

let clientInstance: CursorAgents | undefined;

function getClient(): CursorAgents {
  if (!clientInstance) {
    const opts = program.opts();
    clientInstance = new CursorAgents({
      apiKey: opts.apiKey,
      baseUrl: opts.baseUrl,
    });
  }
  return clientInstance;
}

registerAuthCommands(program, getClient);
registerModelsCommands(program, getClient);
registerAgentsCommands(program, getClient);
registerArtifactsCommands(program, getClient);

program.parse();
