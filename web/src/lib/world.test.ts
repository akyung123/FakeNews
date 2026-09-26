import { describe, expect, it } from "vitest";
import {
  MOCK_IDKIT_RESULT,
  MOCK_RP_CONTEXT_RESPONSE,
  MOCK_WORLD_CHAIN_ID,
  MOCK_WORLD_LAUNCHPAD,
  MOCK_WORLD_VERIFY,
} from "./mock";
import { createWorldClient, isWorldMockEnabled, worldStatusFromIdKitError } from "./world";

describe("world client", () => {
  it("defaults to mock unless VITE_WORLD_MOCK is 0 or false", () => {
    expect(isWorldMockEnabled(undefined)).toBe(true);
    expect(isWorldMockEnabled("1")).toBe(true);
    expect(isWorldMockEnabled("0")).toBe(false);
    expect(isWorldMockEnabled("false")).toBe(false);
  });

  it("maps IDKit cancel codes separately from failures", () => {
    expect(worldStatusFromIdKitError("cancelled")).toBe("cancelled");
    expect(worldStatusFromIdKitError("user_rejected")).toBe("cancelled");
    expect(worldStatusFromIdKitError("verification_rejected")).toBe("cancelled");
    expect(worldStatusFromIdKitError("failed_by_host_app")).toBe("failed");
    expect(worldStatusFromIdKitError("generic_error")).toBe("failed");
  });

  it("returns the world/ GET /rp-context envelope and fixture server signature", async () => {
    const client = createWorldClient({ mock: true });
    expect(client.isMock).toBe(true);
    await expect(client.fetchRpContext()).resolves.toEqual(MOCK_RP_CONTEXT_RESPONSE);
    await expect(
      client.verifyProof({
        wallet: "0x2222222222222222222222222222222222222222",
        idkitResponse: MOCK_IDKIT_RESULT,
      }),
    ).resolves.toEqual(MOCK_WORLD_VERIFY);
  });

  it("calls GET /rp-context and POST /verify in the world/ shape when mock is off", async () => {
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
        return new Response(JSON.stringify(MOCK_WORLD_VERIFY), { status: 200 });
      },
    });

    const envelope = await client.fetchRpContext();
    const verified = await client.verifyProof({
      wallet: "0x2222222222222222222222222222222222222222",
      idkitResponse: MOCK_IDKIT_RESULT,
    });

    expect(envelope).toEqual(MOCK_RP_CONTEXT_RESPONSE);
    expect(seen[0]).toEqual({
      url: "http://world.test/rp-context",
      method: "GET",
      body: null,
    });
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
    expect(verified).toEqual(MOCK_WORLD_VERIFY);
  });
});
