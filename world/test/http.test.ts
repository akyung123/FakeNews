import { describe, expect, test } from "bun:test";
import { createHandler } from "../src/http.ts";
import type { PortalClient } from "../src/portal.ts";
import {
  FIXTURE_NULLIFIER,
  TEST_SIGNER_ADDRESS,
  testConfig,
  uniquenessProof,
  verifyBody,
} from "./helpers.ts";

const config = testConfig();

function handle(request: Request, portal?: PortalClient) {
  return createHandler(config, { portal })(request);
}

describe("http", () => {
  test("GET /rp-context returns IDKit 4 rp-context", async () => {
    const response = await handle(new Request("http://world.test/rp-context"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      app_id: string;
      action: string;
      rp_context: { rp_id: string; nonce: string; created_at: number; expires_at: number; signature: string };
    };
    expect(body.app_id).toBe(config.appId);
    expect(body.action).toBe(config.action);
    expect(body.rp_context.rp_id).toBe(config.rpId);
    expect(body.rp_context.signature.startsWith("0x")).toBe(true);
  });

  test("POST /verify with a mocked Portal returns a recoverable signature", async () => {
    const portal: PortalClient = {
      async verify(idkitResponse) {
        expect(idkitResponse).toEqual(uniquenessProof());
        return {
          success: true,
          nullifier: FIXTURE_NULLIFIER,
          environment: "staging",
          results: [{ success: true, nullifier: FIXTURE_NULLIFIER }],
        };
      },
    };

    const response = await handle(
      new Request("http://world.test/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(verifyBody()),
      }),
      portal,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { nullifier: string; serverSig: string };
    expect(body.nullifier).toBe(FIXTURE_NULLIFIER);
    expect(body.serverSig).toMatch(/^0x[0-9a-fA-F]{130}$/);
  });

  test("POST /verify rejects a Portal failure", async () => {
    const response = await handle(
      new Request("http://world.test/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(verifyBody()),
      }),
      {
        async verify() {
          throw new (await import("../src/errors.ts")).HttpError(
            400,
            "portal_rejected",
            "All proof verifications failed.",
          );
        },
      },
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("portal_rejected");
  });

  test("POST /verify rejects a malformed payload", async () => {
    const response = await handle(
      new Request("http://world.test/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: "nope" }),
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("malformed_payload");
  });

  test("GET /health reports the signer address", async () => {
    const response = await handle(new Request("http://world.test/health"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, signer: TEST_SIGNER_ADDRESS });
  });
});
