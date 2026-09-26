import { describe, expect, it } from "vitest";
import { MOCK_IDKIT_RESULT, MOCK_RP_CONTEXT, MOCK_WORLD_VERIFY } from "./mock";
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

  it("returns INTERFACE-shaped mock rp-context and server signature", async () => {
    const client = createWorldClient({ mock: true });
    expect(client.isMock).toBe(true);
    await expect(client.fetchRpContext({ wallet: "0x1" })).resolves.toEqual(MOCK_RP_CONTEXT);
    await expect(
      client.verifyProof({
        wallet: "0x1",
        rpContext: MOCK_RP_CONTEXT,
        idkitResponse: MOCK_IDKIT_RESULT,
      }),
    ).resolves.toEqual(MOCK_WORLD_VERIFY);
  });

  it("posts rp-context and verify to the world server when mock is off", async () => {
    const seen: { url: string; body: unknown }[] = [];
    const client = createWorldClient({
      mock: false,
      serverUrl: "http://world.test",
      action: "register-prophet",
      fetch: async (input, init) => {
        seen.push({ url: String(input), body: JSON.parse(String(init?.body)) });
        const url = String(input);
        if (url.endsWith("/rp-context")) {
          return new Response(JSON.stringify(MOCK_RP_CONTEXT), { status: 200 });
        }
        return new Response(JSON.stringify(MOCK_WORLD_VERIFY), { status: 200 });
      },
    });

    const rp = await client.fetchRpContext({ wallet: "0xabc" });
    const verified = await client.verifyProof({
      wallet: "0xabc",
      rpContext: rp,
      idkitResponse: MOCK_IDKIT_RESULT,
    });

    expect(seen[0]).toEqual({
      url: "http://world.test/rp-context",
      body: { action: "register-prophet", wallet: "0xabc" },
    });
    expect(seen[1]).toEqual({
      url: "http://world.test/verify",
      body: { wallet: "0xabc", rp_id: MOCK_RP_CONTEXT.rp_id, idkitResponse: MOCK_IDKIT_RESULT },
    });
    expect(verified).toEqual(MOCK_WORLD_VERIFY);
  });
});
