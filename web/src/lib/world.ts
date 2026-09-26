import {
  DEFAULT_WORLD_SERVER_URL,
  MOCK_IDKIT_RESULT,
  MOCK_RP_CONTEXT_RESPONSE,
  MOCK_WORLD_ACTION,
  MOCK_WORLD_APP_ID,
  MOCK_WORLD_CHAIN_ID,
  MOCK_WORLD_HEALTH,
  MOCK_WORLD_LAUNCHPAD,
  MOCK_WORLD_VERIFY,
} from "./mock";

/**
 * Thin World ID client. Mock by default (`VITE_WORLD_MOCK` is not `0`/`false`).
 * Live HTTP matches world/ PR #10 and INTERFACE §3:
 *   GET  {serverUrl}/rp-context  → IDKit 4 { app_id, action, environment, rp_context }
 *   POST {serverUrl}/verify      → Portal v4; errors portal_rejected / malformed_payload / context_mismatch
 *   GET  {serverUrl}/health
 * Default server URL is http://localhost:8787.
 * Live GET /rp-context and POST /verify wait up to 60s (sleeping World server).
 *
 * serverSig is EIP-191 personal_sign of
 * keccak256(abi.encode(uint256 chainId, address launchpad, address wallet, uint256 nullifier)).
 * The Launchpad stores the nullifier on-chain; this client does not.
 */

export type WorldErrorKind =
  | "cancelled"
  | "portal_rejected"
  | "malformed_payload"
  | "network"
  | "nullifier_reuse";

export class WorldClientError extends Error {
  readonly kind: WorldErrorKind;

  constructor(kind: WorldErrorKind) {
    super("World verification failed");
    this.name = "WorldClientError";
    this.kind = kind;
  }
}

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

export type WorldHealth = {
  ok: true;
  signer: string;
};

export type WorldClient = {
  isMock: boolean;
  appId: string;
  action: string;
  chainId: number;
  launchpad: string;
  fetchRpContext: () => Promise<RpContextResponse>;
  verifyProof: (input: { wallet: string; idkitResponse: IdKitResultV4 }) => Promise<WorldServerSignature>;
  checkHealth: () => Promise<WorldHealth>;
};

export type WorldClientOptions = {
  mock?: boolean;
  serverUrl?: string;
  appId?: string;
  action?: string;
  chainId?: number;
  launchpad?: string;
  fetch?: typeof fetch;
  /** Live `/rp-context` and `/verify` only. Default 60s for a sleeping World server. */
  timeoutMs?: number;
};

const CANCELLED_CODES = new Set(["cancelled", "user_rejected", "verification_rejected"]);
const SEPOLIA_CHAIN_ID = 11_155_111;

/** First check can take a minute when the World server has been idle. */
export const WORLD_REQUEST_TIMEOUT_MS = 60_000;

function asWorldClientError(error: unknown): WorldClientError {
  if (error instanceof WorldClientError) return error;
  return new WorldClientError("network");
}

export async function fetchWithTimeout(
  doFetch: typeof fetch,
  input: string,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await new Promise<Response>((resolve, reject) => {
      const fail = () => reject(new WorldClientError("network"));
      if (controller.signal.aborted) {
        fail();
        return;
      }
      controller.signal.addEventListener("abort", fail, { once: true });
      doFetch(input, { ...init, signal: controller.signal }).then(resolve, (error) => {
        reject(asWorldClientError(error));
      });
    });
  } finally {
    clearTimeout(timer);
  }
}

export function isWorldMockEnabled(value = import.meta.env.VITE_WORLD_MOCK): boolean {
  return value !== "0" && value !== "false";
}

export function worldErrorKindFromIdKit(code: string): WorldErrorKind {
  return CANCELLED_CODES.has(code) ? "cancelled" : "network";
}

export function worldStatusFromKind(kind: WorldErrorKind): "cancelled" | "failed" {
  return kind === "cancelled" ? "cancelled" : "failed";
}

export function worldStatusFromIdKitError(code: string): "cancelled" | "failed" {
  return worldStatusFromKind(worldErrorKindFromIdKit(code));
}

export function worldErrorKindFromServerCode(code: unknown): WorldErrorKind {
  if (code === "portal_rejected") return "portal_rejected";
  if (code === "malformed_payload" || code === "context_mismatch") return "malformed_payload";
  return "network";
}

/** Live IDKit must use the server envelope. Portal rejects a proof whose environment is not WORLD_ENVIRONMENT. */
export function idKitConfigFromRpContext(envelope: RpContextResponse): {
  appId: string;
  action: string;
  environment: "production" | "staging";
} {
  return { appId: envelope.app_id, action: envelope.action, environment: envelope.environment };
}

async function errorFromResponse(response: Response): Promise<WorldClientError> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return new WorldClientError(worldErrorKindFromServerCode(body.error));
  } catch {
    return new WorldClientError("network");
  }
}

/**
 * Live World ID stays on the signature server. If that server is down,
 * only this client falls back to the existing mock World step. Auction
 * writes stay on the real chain.
 */
export async function worldClientWithServerFallback(
  client: WorldClient = createWorldClient(),
  createMock: () => WorldClient = () => createWorldClient({ mock: true }),
): Promise<WorldClient> {
  if (client.isMock) return client;
  try {
    await client.checkHealth();
    return client;
  } catch {
    return createMock();
  }
}

export function createWorldClient(options: WorldClientOptions = {}): WorldClient {
  const mock = options.mock ?? isWorldMockEnabled();
  const appId = mock
    ? (options.appId ?? import.meta.env.VITE_WORLD_APP_ID ?? MOCK_WORLD_APP_ID)
    : (options.appId ?? "");
  const action = mock
    ? (options.action ?? import.meta.env.VITE_WORLD_ACTION ?? MOCK_WORLD_ACTION)
    : (options.action ?? "");
  const chainId = options.chainId ?? (Number(import.meta.env.VITE_CHAIN_ID) || SEPOLIA_CHAIN_ID);
  const launchpad = options.launchpad ?? import.meta.env.VITE_LAUNCHPAD_ADDRESS ?? (mock ? MOCK_WORLD_LAUNCHPAD : "");
  const serverUrl = (options.serverUrl ?? import.meta.env.VITE_WORLD_SERVER_URL ?? DEFAULT_WORLD_SERVER_URL).replace(
    /\/$/,
    "",
  );
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? WORLD_REQUEST_TIMEOUT_MS;

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
      async checkHealth() {
        return { ...MOCK_WORLD_HEALTH };
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
      try {
        const response = await fetchWithTimeout(doFetch, `${serverUrl}/rp-context`, { method: "GET" }, timeoutMs);
        if (!response.ok) throw await errorFromResponse(response);
        return (await response.json()) as RpContextResponse;
      } catch (error) {
        throw asWorldClientError(error);
      }
    },
    async verifyProof(input) {
      if (!launchpad) {
        throw new WorldClientError("malformed_payload");
      }
      try {
        const response = await fetchWithTimeout(
          doFetch,
          `${serverUrl}/verify`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              wallet: input.wallet,
              chainId,
              launchpad,
              idkitResponse: input.idkitResponse,
            }),
          },
          timeoutMs,
        );
        if (!response.ok) throw await errorFromResponse(response);
        return (await response.json()) as WorldServerSignature;
      } catch (error) {
        throw asWorldClientError(error);
      }
    },
    async checkHealth() {
      try {
        const response = await doFetch(`${serverUrl}/health`, { method: "GET" });
        if (!response.ok) throw await errorFromResponse(response);
        return (await response.json()) as WorldHealth;
      } catch (error) {
        if (error instanceof WorldClientError) throw error;
        throw new WorldClientError("network");
      }
    },
  };
}

export { MOCK_IDKIT_RESULT };
