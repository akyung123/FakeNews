import {
  MOCK_IDKIT_RESULT,
  MOCK_RP_CONTEXT,
  MOCK_WORLD_ACTION,
  MOCK_WORLD_APP_ID,
  MOCK_WORLD_VERIFY,
} from "./mock";

/**
 * Thin World ID client. Mock by default (`VITE_WORLD_MOCK` is not `0`/`false`).
 * When the world/ server lands, set VITE_WORLD_MOCK=0 and VITE_WORLD_SERVER_URL.
 *
 * Web → world/ (draft, matches INTERFACE §3 signature on the way out):
 *   POST {serverUrl}/rp-context  { action, wallet } → IDKit RpContext
 *   POST {serverUrl}/verify      { wallet, rp_id, idkitResponse } → { nullifier, serverSig }
 */

export type Hex = `0x${string}`;

export type RpContext = {
  rp_id: string;
  nonce: string;
  created_at: number;
  expires_at: number;
  signature: string;
};

export type IdKitResultV4 = {
  protocol_version: "4.0";
  nonce: string;
  action: string;
  environment: "production" | "staging";
  responses: Array<{
    identifier: string;
    signal_hash: string;
    proof: string[];
    nullifier: string;
    issuer_schema_id: number;
    expires_at_min: number;
  }>;
};

/** Launchpad.registerProphet args after the world/ server signs (INTERFACE §3). */
export type WorldServerSignature = {
  nullifier: Hex;
  serverSig: Hex;
};

export type WorldClient = {
  isMock: boolean;
  appId: string;
  action: string;
  fetchRpContext: (input: { wallet: string; action?: string }) => Promise<RpContext>;
  verifyProof: (input: {
    wallet: string;
    rpContext: RpContext;
    idkitResponse: IdKitResultV4;
  }) => Promise<WorldServerSignature>;
};

export type WorldClientOptions = {
  mock?: boolean;
  serverUrl?: string;
  appId?: string;
  action?: string;
  fetch?: typeof fetch;
};

const CANCELLED_CODES = new Set(["cancelled", "user_rejected", "verification_rejected"]);

export function isWorldMockEnabled(value = import.meta.env.VITE_WORLD_MOCK): boolean {
  return value !== "0" && value !== "false";
}

export function worldStatusFromIdKitError(code: string): "cancelled" | "failed" {
  return CANCELLED_CODES.has(code) ? "cancelled" : "failed";
}

export function createWorldClient(options: WorldClientOptions = {}): WorldClient {
  const mock = options.mock ?? isWorldMockEnabled();
  const appId = options.appId ?? import.meta.env.VITE_WORLD_APP_ID ?? MOCK_WORLD_APP_ID;
  const action = options.action ?? import.meta.env.VITE_WORLD_ACTION ?? MOCK_WORLD_ACTION;
  const serverUrl = (options.serverUrl ?? import.meta.env.VITE_WORLD_SERVER_URL ?? "").replace(/\/$/, "");
  const doFetch = options.fetch ?? fetch;

  if (mock) {
    return {
      isMock: true,
      appId,
      action,
      async fetchRpContext() {
        return { ...MOCK_RP_CONTEXT };
      },
      async verifyProof() {
        return { ...MOCK_WORLD_VERIFY };
      },
    };
  }

  return {
    isMock: false,
    appId,
    action,
    async fetchRpContext(input) {
      if (!serverUrl) {
        throw new Error("VITE_WORLD_SERVER_URL is not set");
      }
      const response = await doFetch(`${serverUrl}/rp-context`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: input.action ?? action, wallet: input.wallet }),
      });
      if (!response.ok) {
        throw new Error("Could not fetch World ID rp-context");
      }
      return (await response.json()) as RpContext;
    },
    async verifyProof(input) {
      if (!serverUrl) {
        throw new Error("VITE_WORLD_SERVER_URL is not set");
      }
      const response = await doFetch(`${serverUrl}/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet: input.wallet,
          rp_id: input.rpContext.rp_id,
          idkitResponse: input.idkitResponse,
        }),
      });
      if (!response.ok) {
        throw new Error("World verification failed");
      }
      return (await response.json()) as WorldServerSignature;
    },
  };
}

export { MOCK_IDKIT_RESULT };
