import { signerAddress, type Config } from "./config.ts";
import { HttpError } from "./errors.ts";
import { createPortalClient, type PortalClient } from "./portal.ts";
import { createRpContext } from "./rp-context.ts";
import { verifyAndSign } from "./verify.ts";

export type HandlerDeps = {
  portal?: PortalClient;
};

export function createHandler(config: Config, deps: HandlerDeps = {}) {
  const portal = deps.portal ?? createPortalClient(config);

  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }));
    }

    const path = new URL(request.url).pathname.replace(/\/$/, "") || "/";

    try {
      if (request.method === "GET" && path === "/health") {
        return json(200, { ok: true, signer: signerAddress(config) });
      }
      if ((request.method === "GET" || request.method === "POST") && path === "/rp-context") {
        return json(200, createRpContext(config));
      }
      if (request.method === "POST" && path === "/verify") {
        const body = await readBody(request);
        const result = await verifyAndSign(config, body, portal);
        return json(200, result);
      }
      return json(404, { error: "not_found", detail: "unknown route" });
    } catch (error) {
      if (error instanceof HttpError) {
        return json(error.status, {
          error: error.code,
          detail: error.message,
        });
      }
      if (error instanceof SyntaxError) {
        return json(400, { error: "malformed_payload", detail: "invalid JSON" });
      }
      const detail = error instanceof Error ? error.message : "internal error";
      return json(500, { error: "internal_error", detail });
    }
  };
}

async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) {
    throw new SyntaxError("empty body");
  }
  return JSON.parse(text);
}

function json(status: number, body: unknown): Response {
  return cors(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    }),
  );
}

function cors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  return new Response(response.body, { status: response.status, headers });
}
