import { createRequire } from "node:module";
import { AgentsAPI } from "./agents";
import { ArtifactsAPI } from "./artifacts";
import { BaseClient, type ClientOptions } from "./client";
import {
  type MeResponse,
  MeResponseSchema,
  type ModelsResponse,
  ModelsResponseSchema,
  type RepositoriesResponse,
  RepositoriesResponseSchema,
} from "./schemas";

const require = createRequire(import.meta.url);
const packageJson = readPackageJson();

export const VERSION = packageJson.version;

function readPackageJson(): { version: string } {
  for (const path of ["../package.json", "../../package.json"]) {
    try {
      return require(path) as { version: string };
    } catch {
      continue;
    }
  }

  throw new Error("Unable to resolve package.json for version metadata.");
}

export class CursorAgents {
  readonly agents: AgentsAPI & { artifacts: ArtifactsAPI };
  private readonly client: BaseClient;

  constructor(opts?: ClientOptions) {
    this.client = new BaseClient(opts);
    const agentsApi = new AgentsAPI(this.client);
    const artifactsApi = new ArtifactsAPI(this.client);
    this.agents = Object.assign(agentsApi, { artifacts: artifactsApi });
  }

  async me(): Promise<MeResponse> {
    return this.client.request("/v0/me", MeResponseSchema);
  }

  async models(): Promise<ModelsResponse> {
    return this.client.request("/v0/models", ModelsResponseSchema);
  }

  async repositories(): Promise<RepositoriesResponse> {
    return this.client.request("/v0/repositories", RepositoriesResponseSchema);
  }
}

export type { ClientOptions } from "./client";
export { CursorAgentsError } from "./errors";
export type {
  Agent,
  AgentStatus,
  Artifact,
  Conversation,
  ConversationMessage,
  CreateAgentRequest,
  CreateAgentResponse,
  DownloadArtifactResponse,
  Image,
  ImageDimension,
  ListAgentsResponse,
  ListArtifactsResponse,
  MeResponse,
  ModelsResponse,
  Prompt,
  RepositoriesResponse,
  Repository,
  Source,
  Target,
  Webhook,
} from "./schemas";
