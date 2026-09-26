import {
  MOCK_IDKIT_RESULT,
  MOCK_RP_CONTEXT_RESPONSE,
  MOCK_WORLD_ACTION,
  MOCK_WORLD_APP_ID,
  MOCK_WORLD_CHAIN_ID,
  MOCK_WORLD_LAUNCHPAD,
  MOCK_WORLD_VERIFY,
} from "./mock";

/**
 * Thin World ID client. Mock by default (`VITE_WORLD_MOCK` is not `0`/`false`).
 * Live HTTP matches world/ (PR #10 merged, PR #15 open) and INTERFACE §3:
 *   GET  {serverUrl}/rp-context  → { app_id, action, environment, rp_context }
 *   POST {serverUrl}/verify      { wallet, chainId, launchpad, idkitResponse }
 *                                → { nullifier, serverSig }
 *
 * serverSig is EIP-191 personal_sign of
 * keccak256(abi.encode(uint256 chainId, address launchpad, address wallet, uint256 nullifier)).
 */

export type Hex = `0x${string}`;

export type RpContext = {
  rp_id: string;
  nonce: string;
  created_at: number;
  expires_at: number;
  signature: string;
};

export type RpContextResponse = {
  app_id: string;
  action: string;
  environment: "production" | "staging";
  rp_context: RpContext;
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
  chainId: number;
  launchpad: string;
  fetchRpContext: () => Promise<RpContextResponse>;
  verifyProof: (input: { wallet: string; idkitResponse: IdKitResultV4 }) => Promise<WorldServerSignature>;
};

export type WorldClientOptions = {
  mock?: boolean;
  serverUrl?: string;
  appId?: string;
  action?: string;
  chainId?: number;
  launchpad?: string;
  fetch?: typeof fetch;
};

const CANCELLED_CODES = new Set(["cancelled", "user_rejected", "verification_rejected"]);
const SEPOLIA_CHAIN_ID = 11_155_111;

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
  const chainId = options.chainId ?? (Number(import.meta.env.VITE_CHAIN_ID) || SEPOLIA_CHAIN_ID);
  const launchpad = options.launchpad ?? import.meta.env.VITE_LAUNCHPAD_ADDRESS ?? (mock ? MOCK_WORLD_LAUNCHPAD : "");
  const serverUrl = (options.serverUrl ?? import.meta.env.VITE_WORLD_SERVER_URL ?? "").replace(/\/$/, "");
  const doFetch = options.fetch ?? fetch;

  if (mock) {
    return {
      isMock: true,
      appId,
      action,
      chainId: MOCK_WORLD_CHAIN_ID,
      launchpad: MOCK_WORLD_LAUNCHPAD,
      async fetchRpContext() {
        return { ...MOCK_RP_CONTEXT_RESPONSE, rp_context: { ...MOCK_RP_CONTEXT_RESPONSE.rp_context } };
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
    chainId,
    launchpad,
    async fetchRpContext() {
      if (!serverUrl) {
        throw new Error("VITE_WORLD_SERVER_URL is not set");
      }
      const response = await doFetch(`${serverUrl}/rp-context`, { method: "GET" });
      if (!response.ok) {
        throw new Error("Could not fetch World ID rp-context");
      }
      return (await response.json()) as RpContextResponse;
    },
    async verifyProof(input) {
      if (!serverUrl) {
        throw new Error("VITE_WORLD_SERVER_URL is not set");
      }
      if (!launchpad) {
        throw new Error("VITE_LAUNCHPAD_ADDRESS is not set");
      }
      const response = await doFetch(`${serverUrl}/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet: input.wallet,
          chainId,
          launchpad,
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
