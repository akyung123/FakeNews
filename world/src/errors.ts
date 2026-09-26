export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly extra?: unknown;

  constructor(status: number, code: string, detail: string, extra?: unknown) {
    super(detail);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function malformed(detail: string): HttpError {
  return new HttpError(400, "malformed_payload", detail);
}

export function portalRejected(detail: string, extra?: unknown): HttpError {
  return new HttpError(400, "portal_rejected", detail, extra);
}
