import { describe, expect, it } from "vitest";
import { webEnv } from "./env";
import { MOCK_WORLD_LAUNCHPAD, MOCK_WORLD_VERIFY } from "./mock";
import {
  createRegisterProphet,
  ensAdapterRead,
  readEnsAdapter,
  registerProphetArgs,
  registerProphetWrite,
  type RegisterProphetInput,
} from "./launchpad";
import { launchpadAbi } from "./launchpadAbi";

describe("registerProphet write shape", () => {
  const input: RegisterProphetInput = {
    label: "ringo",
    nullifier: MOCK_WORLD_VERIFY.nullifier,
    serverSig: MOCK_WORLD_VERIFY.serverSig,
  };

  it("encodes { label, nullifier, serverSig } and leaves label out of the signed payload", () => {
    expect(registerProphetArgs(input)).toEqual([
      "ringo",
      BigInt(MOCK_WORLD_VERIFY.nullifier),
      MOCK_WORLD_VERIFY.serverSig,
    ]);
    const request = registerProphetWrite(input, MOCK_WORLD_LAUNCHPAD);
    expect(request.address).toBe(MOCK_WORLD_LAUNCHPAD);
    expect(request.abi).toBe(launchpadAbi);
    expect(request.functionName).toBe("registerProphet");
    expect(request.args[0]).toBe("ringo");
    expect(MOCK_WORLD_VERIFY).not.toHaveProperty("label");
  });

  it("keeps the World ID mock path working when the launchpad is unset", async () => {
    let called = false;
    const run = createRegisterProphet(async () => {
      called = true;
    });
    await run({
      label: "mina",
      nullifier: MOCK_WORLD_VERIFY.nullifier,
      serverSig: MOCK_WORLD_VERIFY.serverSig,
    });
    expect(called).toBe(false);
    expect(() => registerProphetWrite(input)).toThrow(/not set/i);
  });

  it("reads the ENS adapter from launchpad.ens(), not ENS_ADAPTER_ADDRESS", async () => {
    const adapter = "0x3333333333333333333333333333333333333333" as const;
    const request = ensAdapterRead(MOCK_WORLD_LAUNCHPAD);
    expect(request.functionName).toBe("ens");
    expect(request.args).toEqual([]);
    expect(request.abi).toBe(launchpadAbi);
    const seen: unknown[] = [];
    const got = await readEnsAdapter({
      async readContract(req) {
        seen.push(req);
        return adapter;
      },
    }, MOCK_WORLD_LAUNCHPAD);
    expect(got).toBe(adapter);
    expect(seen).toEqual([ensAdapterRead(MOCK_WORLD_LAUNCHPAD)]);
    expect(JSON.stringify({ request, env: import.meta.env })).not.toMatch(/ENS_ADAPTER_ADDRESS/);
  });
});
