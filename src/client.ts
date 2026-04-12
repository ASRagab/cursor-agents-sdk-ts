import { resolve } from "node:path";
import { config as loadDotEnv } from "dotenv";
import type { z } from "zod";
import { CursorAgentsError, errorCodeFromStatus } from "./errors";

const DEFAULT_BASE_URL = "https://api.cursor.com";

export interface ClientOptions {
  apiKey?: string;
  baseUrl?: string;
}

export class BaseClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(opts?: ClientOptions) {
    loadDotEnv({ path: resolve(process.cwd(), ".env"), override: false });

    const key = opts?.apiKey ?? process.env.CURSOR_API_KEY;
    if (!key) {
      throw new CursorAgentsError({
        code: "unauthorized",
        status: 401,
        message:
          "Missing API key. Set CURSOR_API_KEY in your environment or .env file, or pass apiKey option.",
      });
    }
    this.apiKey = key;
    this.baseUrl = opts?.baseUrl ?? process.env.CURSOR_BASE_URL ?? DEFAULT_BASE_URL;
  }

  async request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
      ...((init?.headers as Record<string, string>) ?? {}),
    };

    const response = await fetch(url, { ...init, headers });

    if (!response.ok) {
      let raw: unknown;
      try {
        raw = await response.json();
      } catch {
        raw = undefined;
      }

      const message =
        raw && typeof raw === "object" && "error" in raw
          ? ((
              (raw as Record<string, unknown>).error as Record<string, unknown>
            )?.message?.toString() ?? response.statusText)
          : response.statusText;

      throw new CursorAgentsError({
        code: errorCodeFromStatus(response.status),
        status: response.status,
        message,
        raw,
      });
    }

    if (response.status === 204) {
      return schema.parse({});
    }

    const json = await response.json();
    const result = schema.safeParse(json);
    if (!result.success) {
      throw new CursorAgentsError({
        code: "validation_error",
        status: response.status,
        message: `Response validation failed: ${result.error.message}`,
        raw: json,
      });
    }
    return result.data;
  }
}
