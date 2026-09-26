import { describe, expect, it, vi } from "vitest";
import { readLaunchpadDeployBlock, webEnv } from "./env";
import { MOCK_WORLD_LAUNCHPAD, MOCK_WORLD_VERIFY } from "./mock";
import {
  assertSuccessfulReceipt,
  createRegisterProphet,
  curveRead,
  ensAdapterRead,
  fetchLaunchedLogs,
  LAUNCHED_LOOKBACK_BLOCKS,
  launchedFromBlock,
  launchedLogsQuery,
  readEnsAdapter,
  registerProphetArgs,
  registerProphetWrite,
  type RegisterProphetInput,
} from "./launchpad";
import { launchpadAbi } from "./launchpadAbi";
import { wagmiConfig } from "./wagmi";

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

  it("simulates, then calls writeContract with registerProphet args, then requires a successful receipt", async () => {
    const hash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
    const simulate = vi.fn(async () => ({ result: undefined }));
    const write = vi.fn(async () => hash);
    const wait = vi.fn(async () => ({ status: "success" }));
    const run = createRegisterProphet(undefined, {
      address: MOCK_WORLD_LAUNCHPAD,
      simulateContract: simulate,
      writeContract: write,
      waitForTransactionReceipt: wait,
    });
    await run(input);
    const request = registerProphetWrite(input, MOCK_WORLD_LAUNCHPAD);
    expect(simulate).toHaveBeenCalledTimes(1);
    expect(simulate).toHaveBeenCalledWith(wagmiConfig, request);
    expect(write).toHaveBeenCalledTimes(1);
    const [config, written] = write.mock.calls[0];
    expect(config).toBe(wagmiConfig);
    expect(written.address).toBe(MOCK_WORLD_LAUNCHPAD);
    expect(written.abi).toBe(launchpadAbi);
    expect(written.functionName).toBe("registerProphet");
    expect(written.args).toEqual([
      "ringo",
      BigInt(MOCK_WORLD_VERIFY.nullifier),
      MOCK_WORLD_VERIFY.serverSig,
    ]);
    expect(wait).toHaveBeenCalledTimes(1);
    expect(wait).toHaveBeenCalledWith(wagmiConfig, { hash });
  });

  it("does not call writeContract when simulateContract throws", async () => {
    const simulate = vi.fn(async () => {
      throw new Error("NullifierUsed");
    });
    const write = vi.fn(async () => {
      throw new Error("write must not run after a failed simulation");
    });
    const wait = vi.fn(async () => {
      throw new Error("wait must not run after a failed simulation");
    });
    const run = createRegisterProphet(undefined, {
      address: MOCK_WORLD_LAUNCHPAD,
      simulateContract: simulate,
      writeContract: write,
      waitForTransactionReceipt: wait,
    });
    await expect(run(input)).rejects.toThrow(/NullifierUsed/);
    expect(simulate).toHaveBeenCalledTimes(1);
    expect(write).not.toHaveBeenCalled();
    expect(wait).not.toHaveBeenCalled();
  });

  it("throws when the receipt status is not success", async () => {
    const hash = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
    const simulate = vi.fn(async () => ({ result: undefined }));
    const write = vi.fn(async () => hash);
    const wait = vi.fn(async () => ({ status: "reverted" }));
    const run = createRegisterProphet(undefined, {
      address: MOCK_WORLD_LAUNCHPAD,
      simulateContract: simulate,
      writeContract: write,
      waitForTransactionReceipt: wait,
    });
    await expect(run(input)).rejects.toThrow(/did not succeed/);
    expect(write).toHaveBeenCalledTimes(1);
    expect(() => assertSuccessfulReceipt({ status: "reverted" })).toThrow(/did not succeed/);
    expect(() => assertSuccessfulReceipt({ status: "success" })).not.toThrow();
  });

  it("does not call wagmi writeContract in mock mode", async () => {
    const simulate = vi.fn(async () => {
      throw new Error("simulate must not run in mock mode");
    });
    const write = vi.fn(async () => {
      throw new Error("write must not run in mock mode");
    });
    const wait = vi.fn(async () => {
      throw new Error("wait must not run in mock mode");
    });
    const run = createRegisterProphet(undefined, {
      address: undefined,
      simulateContract: simulate,
      writeContract: write,
      waitForTransactionReceipt: wait,
    });
    await run(input);
    expect(simulate).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(wait).not.toHaveBeenCalled();
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
    expect(webEnv).not.toHaveProperty("ensAdapterAddress");
    expect(Object.keys(webEnv).join(",")).not.toMatch(/ENS_ADAPTER/);
  });

  it("reads curve(token) for the complete flag", () => {
    const token = "0xa555555555555555555555555555555555555555" as const;
    const request = curveRead(token, MOCK_WORLD_LAUNCHPAD);
    expect(request.functionName).toBe("curve");
    expect(request.args).toEqual([token]);
    expect(request.abi).toBe(launchpadAbi);
    expect(launchpadAbi.some((item) => "name" in item && item.name === "getState")).toBe(false);
  });
});

describe("Launched log fromBlock", () => {
  const latest = 80_000n;

  it("uses VITE_LAUNCHPAD_DEPLOY_BLOCK when it is a decimal block number", () => {
    expect(readLaunchpadDeployBlock("12345678")).toBe(12_345_678n);
    expect(readLaunchpadDeployBlock("0")).toBe(0n);
    expect(launchedFromBlock(12_345_678n, latest)).toBe(12_345_678n);
    const query = launchedLogsQuery(latest, MOCK_WORLD_LAUNCHPAD, 12_345_678n);
    expect(query.address).toBe(MOCK_WORLD_LAUNCHPAD);
    expect(query.abi).toBe(launchpadAbi);
    expect(query.eventName).toBe("Launched");
    expect(query.fromBlock).toBe(12_345_678n);
    expect(query.toBlock).toBe(latest);
  });

  it("queries a recent window when the deploy block is unset or invalid, never block 0 from a missing env", () => {
    expect(readLaunchpadDeployBlock(undefined)).toBeUndefined();
    expect(readLaunchpadDeployBlock("")).toBeUndefined();
    expect(readLaunchpadDeployBlock("  ")).toBeUndefined();
    expect(readLaunchpadDeployBlock("nope")).toBeUndefined();
    expect(readLaunchpadDeployBlock("-1")).toBeUndefined();
    expect(readLaunchpadDeployBlock("1.5")).toBeUndefined();
    expect(readLaunchpadDeployBlock("0x10")).toBeUndefined();
    expect(webEnv.launchpadDeployBlock).toBeUndefined();
    expect(LAUNCHED_LOOKBACK_BLOCKS).toBe(50_000n);
    expect(launchedFromBlock(undefined, 80_000n)).toBe(30_000n);
    expect(launchedFromBlock(undefined, 50_000n)).toBe(0n);
    expect(launchedFromBlock(undefined, 10_000n)).toBe(0n);
    expect(launchedFromBlock(undefined, 0n)).toBe(0n);
    const query = launchedLogsQuery(80_000n, MOCK_WORLD_LAUNCHPAD, undefined);
    expect(query.fromBlock).toBe(30_000n);
    expect(query.fromBlock).not.toBe(0n);
    expect(query.eventName).toBe("Launched");
  });

  it("fetchLaunchedLogs uses the deploy block when set and the recent window when not", async () => {
    const seen: unknown[] = [];
    const logs = [{ eventName: "Launched" }];
    const withBlock = await fetchLaunchedLogs(
      {
        async getBlockNumber() {
          return 90_000n;
        },
        async getContractEvents(query) {
          seen.push(query);
          return logs;
        },
      },
      MOCK_WORLD_LAUNCHPAD,
      12_000n,
    );
    expect(withBlock).toBe(logs);
    expect(seen).toEqual([launchedLogsQuery(90_000n, MOCK_WORLD_LAUNCHPAD, 12_000n)]);
    expect((seen[0] as { fromBlock: bigint }).fromBlock).toBe(12_000n);

    seen.length = 0;
    const recent = await fetchLaunchedLogs(
      {
        async getBlockNumber() {
          return 80_000n;
        },
        async getContractEvents(query) {
          seen.push(query);
          return [];
        },
      },
      MOCK_WORLD_LAUNCHPAD,
      undefined,
    );
    expect(recent).toEqual([]);
    expect((seen[0] as { fromBlock: bigint }).fromBlock).toBe(30_000n);

    const mockMode = await fetchLaunchedLogs(
      {
        async getBlockNumber() {
          throw new Error("must not hit RPC in mock mode");
        },
        async getContractEvents() {
          throw new Error("must not query logs in mock mode");
        },
      },
      undefined,
      undefined,
    );
    expect(mockMode).toEqual([]);
  });
});
