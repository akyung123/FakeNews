import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORLD_SERVER_URL,
  MOCK_IDKIT_RESULT,
  MOCK_RP_CONTEXT_RESPONSE,
  MOCK_WORLD_ACTION,
  MOCK_WORLD_APP_ID,
  MOCK_WORLD_ENVIRONMENT,
  MOCK_WORLD_CHAIN_ID,
  MOCK_WORLD_HEALTH,
  MOCK_WORLD_LAUNCHPAD,
  MOCK_WORLD_VERIFY,
} from "./mock";
import {
  createWorldClient,
  idKitConfigFromRpContext,
  isWorldMockEnabled,
  WorldClientError,
  WORLD_REQUEST_TIMEOUT_MS,
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
    expect(worldErrorKindFromServerCode("context_mismatch")).toBe("malformed_payload");
    expect(worldErrorKindFromServerCode("nope")).toBe("network");
  });

  it("reuses world/fixture/register-prophet-signature.json and does not export the signer key", async () => {
    const fixture = await import("../../../world/fixture/register-prophet-signature.json");
    expect(MOCK_WORLD_CHAIN_ID).toBe(fixture.chainId);
    expect(MOCK_WORLD_LAUNCHPAD).toBe(fixture.launchpad);
    expect(MOCK_WORLD_VERIFY).toEqual({
      nullifier: fixture.nullifier,
      serverSig: fixture.serverSig,
    });
    expect(MOCK_WORLD_HEALTH.signer).toBe(fixture.signer);
    expect(JSON.stringify({ ...MOCK_WORLD_VERIFY, ...MOCK_WORLD_HEALTH })).not.toContain(fixture.signerKey);
  });

  it("uses app_id, action, and environment from GET /rp-context in live mode, not the mock defaults", async () => {
    const serverEnvelope = {
      ...MOCK_RP_CONTEXT_RESPONSE,
      app_id: "app_from_server",
      action: "action_from_server",
      environment: "production" as const,
    };
    const client = createWorldClient({
      mock: false,
      appId: "app_from_env",
      action: "action_from_env",
      serverUrl: "http://world.test",
      launchpad: MOCK_WORLD_LAUNCHPAD,
      fetch: async () => new Response(JSON.stringify(serverEnvelope), { status: 200 }),
    });
    const envelope = await client.fetchRpContext();
    expect(idKitConfigFromRpContext(envelope)).toEqual({
      appId: "app_from_server",
      action: "action_from_server",
      environment: "production",
    });
    expect(idKitConfigFromRpContext(envelope).appId).not.toBe(client.appId);
    expect(idKitConfigFromRpContext(envelope).action).not.toBe(client.action);
    expect(idKitConfigFromRpContext(envelope).environment).not.toBe(MOCK_WORLD_ENVIRONMENT);
  });

  it("uses VITE_WORLD_APP_ID, VITE_WORLD_ACTION, and the mock environment only as mock-mode defaults", async () => {
    const mock = createWorldClient({ mock: true });
    expect(mock.appId).toBe(MOCK_WORLD_APP_ID);
    expect(mock.action).toBe(MOCK_WORLD_ACTION);
    const envelope = await mock.fetchRpContext();
    expect(idKitConfigFromRpContext(envelope)).toEqual({
      appId: MOCK_WORLD_APP_ID,
      action: MOCK_WORLD_ACTION,
      environment: MOCK_WORLD_ENVIRONMENT,
    });
    const live = createWorldClient({ mock: false, launchpad: MOCK_WORLD_LAUNCHPAD });
    expect(live.appId).toBe("");
    expect(live.action).toBe("");
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

  it("maps context_mismatch to the same kind and retry sentence as malformed_payload", async () => {
    expect(worldErrorKindFromServerCode("context_mismatch")).toBe("malformed_payload");
    const client = createWorldClient({
      mock: false,
      serverUrl: "http://world.test",
      launchpad: MOCK_WORLD_LAUNCHPAD,
      fetch: async () => new Response(JSON.stringify({ error: "context_mismatch" }), { status: 400 }),
    });
    await expect(
      client.verifyProof({
        wallet: "0x2222222222222222222222222222222222222222",
        idkitResponse: MOCK_IDKIT_RESULT,
      }),
    ).rejects.toMatchObject({ kind: "malformed_payload", message: "World verification failed" });
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

  it("uses a 60s live timeout and maps only timeout or a dropped request to network", async () => {
    expect(WORLD_REQUEST_TIMEOUT_MS).toBe(60_000);

    const hanging = createWorldClient({
      mock: false,
      serverUrl: "http://world.test",
      launchpad: MOCK_WORLD_LAUNCHPAD,
      timeoutMs: 40,
      fetch: () => new Promise(() => {}),
    });
    await expect(hanging.fetchRpContext()).rejects.toMatchObject({
      kind: "network",
      message: "World verification failed",
    });
    await expect(
      hanging.verifyProof({
        wallet: "0x2222222222222222222222222222222222222222",
        idkitResponse: MOCK_IDKIT_RESULT,
      }),
    ).rejects.toMatchObject({ kind: "network" });

    const slowOk = createWorldClient({
      mock: false,
      serverUrl: "http://world.test",
      launchpad: MOCK_WORLD_LAUNCHPAD,
      timeoutMs: 200,
      fetch: async (input) => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        const url = String(input);
        if (url.endsWith("/rp-context")) {
          return new Response(JSON.stringify(MOCK_RP_CONTEXT_RESPONSE), { status: 200 });
        }
        return new Response(JSON.stringify(MOCK_WORLD_VERIFY), { status: 200 });
      },
    });
    await expect(slowOk.fetchRpContext()).resolves.toEqual(MOCK_RP_CONTEXT_RESPONSE);
    await expect(
      slowOk.verifyProof({
        wallet: "0x2222222222222222222222222222222222222222",
        idkitResponse: MOCK_IDKIT_RESULT,
      }),
    ).resolves.toEqual(MOCK_WORLD_VERIFY);
  });

  it("passes an abort signal on live /rp-context and /verify", async () => {
    const signals: Array<AbortSignal | undefined> = [];
    const client = createWorldClient({
      mock: false,
      serverUrl: "http://world.test",
      launchpad: MOCK_WORLD_LAUNCHPAD,
      fetch: async (input, init) => {
        signals.push(init?.signal);
        const url = String(input);
        if (url.endsWith("/rp-context")) {
          return new Response(JSON.stringify(MOCK_RP_CONTEXT_RESPONSE), { status: 200 });
        }
        return new Response(JSON.stringify(MOCK_WORLD_VERIFY), { status: 200 });
      },
    });
    await client.fetchRpContext();
    await client.verifyProof({
      wallet: "0x2222222222222222222222222222222222222222",
      idkitResponse: MOCK_IDKIT_RESULT,
    });
    expect(signals).toHaveLength(2);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
    expect(signals[1]).toBeInstanceOf(AbortSignal);
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
