import type { Config } from "./config.ts";
import { portalRejected } from "./errors.ts";

export type PortalClient = {
  verify(idkitResponse: unknown): Promise<PortalSuccess>;
};

export type PortalSuccess = {
  success: true;
  action?: string;
  nullifier?: string;
  environment?: string;
  results?: Array<{
    identifier?: string;
    success?: boolean;
    nullifier?: string;
    code?: string;
    detail?: string;
  }>;
};

export function createPortalClient(
  config: Config,
  portalFetch: typeof fetch = fetch,
): PortalClient {
  return {
    async verify(idkitResponse: unknown): Promise<PortalSuccess> {
      const url = `${config.portalBaseUrl}/api/v4/verify/${encodeURIComponent(config.rpId)}`;
      let response: Response;
      try {
        response = await portalFetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(idkitResponse),
        });
      } catch (error) {
        throw portalRejected("Portal v4 verify request failed", {
          detail: error instanceof Error ? error.message : "network error",
        });
      }

      const body = await readJson(response);
      if (!response.ok) {
        throw portalRejected(portalErrorDetail(body, response.status), body);
      }
      if (!isObject(body) || body.success !== true) {
        throw portalRejected(portalErrorDetail(body, response.status), body);
      }

      const environment = typeof body.environment === "string" ? body.environment : undefined;
      if (environment && environment !== config.environment) {
        throw portalRejected(
          `Portal environment ${environment} does not match ${config.environment}`,
          body,
        );
      }

      return body as PortalSuccess;
    },
  };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function portalErrorDetail(body: unknown, status: number): string {
  if (isObject(body)) {
    if (typeof body.detail === "string" && body.detail.length > 0) {
      return body.detail;
    }
    if (typeof body.code === "string" && body.code.length > 0) {
      return body.code;
    }
  }
  return `Portal v4 verify failed (${status})`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
