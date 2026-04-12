import type { BaseClient } from "./client";
import {
  type Agent,
  AgentSchema,
  type Conversation,
  type ConversationMessage,
  ConversationSchema,
  type CreateAgentResponse,
  CreateAgentResponseSchema,
  type IdResponse,
  IdResponseSchema,
  type ListAgentsResponse,
  ListAgentsResponseSchema,
  type Prompt,
  type Target,
  type Webhook,
} from "./schemas";

export interface CreateAgentOpts {
  prompt: Prompt;
  source: { repository: string; ref?: string } | { prUrl: string };
  model?: string;
  target?: Target;
  webhook?: Webhook;
}

export interface ListAgentsOpts {
  limit?: number;
  cursor?: string;
  prUrl?: string;
}

export interface WaitForOpts {
  intervalMs?: number;
  timeoutMs?: number;
  onStatus?: (agent: Agent) => void;
}

export interface WatchOpts {
  intervalMs?: number;
  onMessage?: (msg: ConversationMessage) => void;
  onStatus?: (agent: Agent) => void;
}

const TERMINAL_STATUSES = new Set(["FINISHED", "ERROR", "EXPIRED"]);

export class AgentsAPI {
  constructor(private readonly client: BaseClient) {}

  async create(opts: CreateAgentOpts): Promise<CreateAgentResponse> {
    return this.client.request("/v0/agents", CreateAgentResponseSchema, {
      method: "POST",
      body: JSON.stringify({
        prompt: opts.prompt,
        source: opts.source,
        model: opts.model,
        target: opts.target,
        webhook: opts.webhook,
      }),
    });
  }

  async list(opts?: ListAgentsOpts): Promise<ListAgentsResponse> {
    const params = new URLSearchParams();
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.cursor) params.set("cursor", opts.cursor);
    if (opts?.prUrl) params.set("prUrl", opts.prUrl);
    const qs = params.toString();
    return this.client.request(`/v0/agents${qs ? `?${qs}` : ""}`, ListAgentsResponseSchema);
  }

  async get(id: string): Promise<Agent> {
    return this.client.request(`/v0/agents/${id}`, AgentSchema);
  }

  async delete(id: string): Promise<IdResponse> {
    return this.client.request(`/v0/agents/${id}`, IdResponseSchema, { method: "DELETE" });
  }

  async stop(id: string): Promise<IdResponse> {
    return this.client.request(`/v0/agents/${id}/stop`, IdResponseSchema, { method: "POST" });
  }

  async followup(id: string, opts: { prompt: Prompt }): Promise<IdResponse> {
    return this.client.request(`/v0/agents/${id}/followup`, IdResponseSchema, {
      method: "POST",
      body: JSON.stringify({ prompt: opts.prompt }),
    });
  }

  async conversation(id: string): Promise<Conversation> {
    return this.client.request(`/v0/agents/${id}/conversation`, ConversationSchema);
  }

  async waitFor(id: string, opts?: WaitForOpts): Promise<Agent> {
    const interval = opts?.intervalMs ?? 5000;
    const timeout = opts?.timeoutMs ?? 600_000;
    const start = Date.now();

    while (true) {
      const agent = await this.get(id);
      opts?.onStatus?.(agent);

      if (TERMINAL_STATUSES.has(agent.status)) {
        return agent;
      }

      if (Date.now() - start >= timeout) {
        throw new (await import("./errors")).CursorAgentsError({
          code: "timeout",
          status: 0,
          message: `Timed out waiting for agent ${id} after ${timeout}ms`,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  async watch(id: string, opts?: WatchOpts): Promise<Agent> {
    const interval = opts?.intervalMs ?? 3000;
    const seenMessageIds = new Set<string>();

    while (true) {
      const agent = await this.get(id);
      opts?.onStatus?.(agent);

      try {
        const convo = await this.conversation(id);
        for (const msg of convo.messages) {
          if (!seenMessageIds.has(msg.id)) {
            seenMessageIds.add(msg.id);
            opts?.onMessage?.(msg);
          }
        }
      } catch {
        // conversation may not be available yet
      }

      if (TERMINAL_STATUSES.has(agent.status)) {
        return agent;
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
}
