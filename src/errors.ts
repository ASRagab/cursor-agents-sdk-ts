export class CursorAgentsError extends Error {
  readonly code: string;
  readonly status: number;
  readonly raw?: unknown;

  constructor(opts: { code: string; status: number; message: string; raw?: unknown }) {
    super(opts.message);
    this.name = "CursorAgentsError";
    this.code = opts.code;
    this.status = opts.status;
    this.raw = opts.raw;
  }
}

const STATUS_CODE_MAP: Record<number, string> = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  429: "rate_limited",
  500: "internal_error",
};

export function errorCodeFromStatus(status: number): string {
  return STATUS_CODE_MAP[status] ?? "unknown_error";
}
