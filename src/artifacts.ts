import type { BaseClient } from "./client";
import {
  type DownloadArtifactResponse,
  DownloadArtifactResponseSchema,
  type ListArtifactsResponse,
  ListArtifactsResponseSchema,
} from "./schemas";

export class ArtifactsAPI {
  constructor(private readonly client: BaseClient) {}

  async list(agentId: string): Promise<ListArtifactsResponse> {
    return this.client.request(`/v0/agents/${agentId}/artifacts`, ListArtifactsResponseSchema);
  }

  async downloadUrl(agentId: string, absolutePath: string): Promise<DownloadArtifactResponse> {
    const params = new URLSearchParams({ path: absolutePath });
    return this.client.request(
      `/v0/agents/${agentId}/artifacts/download?${params}`,
      DownloadArtifactResponseSchema,
    );
  }
}
