import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORLD_SERVER_URL,
  MOCK_IDKIT_RESULT,
  MOCK_RP_CONTEXT_RESPONSE,
  MOCK_WORLD_CHAIN_ID,
  MOCK_WORLD_HEALTH,
  MOCK_WORLD_LAUNCHPAD,
  MOCK_WORLD_VERIFY,
} from "./mock";
import {
  createWorldClient,
  isWorldMockEnabled,
  WorldClientError,
  worldErrorKindFromIdKit,
  worldErrorKindFromServerCode,
  worldStatusFromIdKitError,
} from "./world";

describe("world client", () => {
  it("defaults to mock unless VITE_WORLD_MOCK is 0 or false", () => {
    expect(isWorldMockEnabled(undefined)).toBe(true);
    expect(isWorldMockEnabled("1")).toBe(true);
    expect(isWorldMockEnabled("0")).toBe(false);
    expect(isWorldMockEnabled("false")).toBe(false);
  });

  it("maps IDKit cancel codes separately from other widget failures", () => {
    expect(worldErrorKindFromIdKit("cancelled")).toBe("cancelled");
    expect(worldErrorKindFromIdKit("user_rejected")).toBe("cancelled");
    expect(worldErrorKindFromIdKit("verification_rejected")).toBe("cancelled");
    expect(worldErrorKindFromIdKit("generic_error")).toBe("network");
    expect(worldStatusFromIdKitError("cancelled")).toBe("cancelled");
    expect(worldStatusFromIdKitError("generic_error")).toBe("failed");
  });

  it("maps world/ verify error codes and never treats unknown codes as portal_rejected", () => {
    expect(worldErrorKindFromServerCode("portal_rejected")).toBe("portal_rejected");
    expect(worldErrorKindFromServerCode("malformed_payload")).toBe("malformed_payload");
    expect(worldErrorKindFromServerCode("context_mismatch")).toBe("network");
    expect(worldErrorKindFromServerCode("nope")).toBe("network");
  });

  it("returns the world/ GET /rp-context envelope, fixture signature, and health", async () => {
    const client = createWorldClient({ mock: true });
    expect(client.isMock).toBe(true);
    await expect(client.fetchRpContext()).resolves.toEqual(MOCK_RP_CONTEXT_RESPONSE);
    await expect(
      client.verifyProof({
        wallet: "0x2222222222222222222222222222222222222222",
        idkitResponse: MOCK_IDKIT_RESULT,
      }),
    ).resolves.toEqual(MOCK_WORLD_VERIFY);
    await expect(client.checkHealth()).resolves.toEqual(MOCK_WORLD_HEALTH);
  });

  it("calls GET /rp-context, POST /verify, and GET /health in the world/ #10 shape", async () => {
    const seen: { url: string; method: string; body: unknown }[] = [];
    const client = createWorldClient({
      mock: false,
      serverUrl: "http://world.test",
      action: "register-prophet",
      chainId: MOCK_WORLD_CHAIN_ID,
      launchpad: MOCK_WORLD_LAUNCHPAD,
      fetch: async (input, init) => {
        const method = init?.method ?? "GET";
        seen.push({
          url: String(input),
          method,
          body: init?.body ? JSON.parse(String(init.body)) : null,
        });
        const url = String(input);
        if (url.endsWith("/rp-context")) {
          return new Response(JSON.stringify(MOCK_RP_CONTEXT_RESPONSE), { status: 200 });
        }
        if (url.endsWith("/health")) {
          return new Response(JSON.stringify(MOCK_WORLD_HEALTH), { status: 200 });
        }
        return new Response(JSON.stringify(MOCK_WORLD_VERIFY), { status: 200 });
      },
    });

    const envelope = await client.fetchRpContext();
    const verified = await client.verifyProof({
      wallet: "0x2222222222222222222222222222222222222222",
      idkitResponse: MOCK_IDKIT_RESULT,
    });
    const health = await client.checkHealth();

    expect(envelope).toEqual(MOCK_RP_CONTEXT_RESPONSE);
    expect(health).toEqual(MOCK_WORLD_HEALTH);
    expect(seen[0]).toEqual({ url: "http://world.test/rp-context", method: "GET", body: null });
    expect(seen[1]).toEqual({
      url: "http://world.test/verify",
      method: "POST",
      body: {
        wallet: "0x2222222222222222222222222222222222222222",
        chainId: MOCK_WORLD_CHAIN_ID,
        launchpad: MOCK_WORLD_LAUNCHPAD,
        idkitResponse: MOCK_IDKIT_RESULT,
      },
    });
    expect(seen[2]).toEqual({ url: "http://world.test/health", method: "GET", body: null });
    expect(verified).toEqual(MOCK_WORLD_VERIFY);
  });

  it("defaults the live server to localhost:8787", async () => {
    const seen: string[] = [];
    const client = createWorldClient({
      mock: false,
      launchpad: MOCK_WORLD_LAUNCHPAD,
      fetch: async (input) => {
        seen.push(String(input));
        return new Response(JSON.stringify(MOCK_WORLD_HEALTH), { status: 200 });
      },
    });
    await client.checkHealth();
    expect(seen[0]).toBe(`${DEFAULT_WORLD_SERVER_URL}/health`);
  });

  it("throws a typed WorldClientError for portal_rejected and malformed_payload", async () => {
    const client = createWorldClient({
      mock: false,
      serverUrl: "http://world.test",
      launchpad: MOCK_WORLD_LAUNCHPAD,
      fetch: async () =>
        new Response(JSON.stringify({ error: "portal_rejected", detail: "nope" }), { status: 400 }),
    });
    await expect(
      client.verifyProof({
        wallet: "0x2222222222222222222222222222222222222222",
        idkitResponse: MOCK_IDKIT_RESULT,
      }),
    ).rejects.toMatchObject({ kind: "portal_rejected" });

    const malformed = createWorldClient({
      mock: false,
      serverUrl: "http://world.test",
      launchpad: MOCK_WORLD_LAUNCHPAD,
      fetch: async () => new Response(JSON.stringify({ error: "malformed_payload" }), { status: 400 }),
    });
    await expect(
      malformed.verifyProof({
        wallet: "0x2222222222222222222222222222222222222222",
        idkitResponse: MOCK_IDKIT_RESULT,
      }),
    ).rejects.toBeInstanceOf(WorldClientError);
    await expect(
      malformed.verifyProof({
        wallet: "0x2222222222222222222222222222222222222222",
        idkitResponse: MOCK_IDKIT_RESULT,
      }),
    ).rejects.toMatchObject({ kind: "malformed_payload" });
  });

  it("treats a dropped connection as network and keeps codes off the Error message", async () => {
    const client = createWorldClient({
      mock: false,
      serverUrl: "http://world.test",
      launchpad: MOCK_WORLD_LAUNCHPAD,
      fetch: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    await expect(
      client.verifyProof({
        wallet: "0x2222222222222222222222222222222222222222",
        idkitResponse: MOCK_IDKIT_RESULT,
      }),
    ).rejects.toMatchObject({ kind: "network", message: "World verification failed" });
  });
});
