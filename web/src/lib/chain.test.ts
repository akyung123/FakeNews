import { describe, expect, it, vi } from "vitest";
import { onSepolia, requireSepolia, switchWalletToSepolia, WRITE_CHAIN_ID } from "./chain";
import { createLaunch, launchWrite } from "./writes";
import { createRegisterProphet } from "./launchpad";
import { sendCcaWrite } from "./cca/writes";
import { ccaAbi } from "./cca/abi/cca";
import { wagmiConfig } from "./wagmi";
import { MOCK_WORLD_LAUNCHPAD, MOCK_WORLD_VERIFY, MOCK_WORLD_WALLET } from "./mock";

const AUCTION = "0x2222222222222222222222222222222222222222" as const;

describe("Sepolia gate before writes", () => {
  it("pins chainId 11155111 on a request", () => {
    expect(WRITE_CHAIN_ID).toBe(11_155_111);
    expect(onSepolia({ functionName: "launch" })).toEqual({ functionName: "launch", chainId: 11_155_111 });
  });

  it("switches a wallet on another chain to 11155111", async () => {
    let chainId = 1;
    const switchChain = vi.fn(async (id: number) => {
      chainId = id;
    });
    await expect(switchWalletToSepolia({ getChainId: () => chainId, switchChain })).resolves.toBe(true);
    expect(switchChain).toHaveBeenCalledWith(11_155_111);
  });

  it("does nothing when the wallet is already on Sepolia or not connected", async () => {
    const switchChain = vi.fn(async () => undefined);
    await expect(switchWalletToSepolia({ getChainId: () => 11_155_111, switchChain })).resolves.toBe(true);
    await expect(switchWalletToSepolia({ getChainId: () => undefined, switchChain })).resolves.toBe(true);
    expect(switchChain).not.toHaveBeenCalled();
  });

  it("refuses to write when the wallet declines the switch", async () => {
    const switchChain = vi.fn(async () => {
      throw new Error("User rejected");
    });
    await expect(requireSepolia({ getChainId: () => 1, switchChain })).rejects.toThrow("Switch to Sepolia");
  });
});

describe("every write path sends chainId: sepolia.id", () => {
  it("launch: simulate and write both carry chainId, after the chain check", async () => {
    const order: string[] = [];
    const simulateContract = vi.fn(async (_c: unknown, request: Record<string, unknown>) => {
      order.push("simulate");
      return { request };
    });
    const writeContract = vi.fn(async () => {
      order.push("write");
      return `0x${"aa".repeat(32)}` as const;
    });
    const run = createLaunch({
      address: MOCK_WORLD_LAUNCHPAD,
      simulateContract,
      writeContract,
      waitForTransactionReceipt: async () => ({ status: "success", logs: [] }),
      findLaunched: async () => AUCTION,
      ensureChain: async () => {
        order.push("switch");
      },
    });
    await run({ slug: "lingo-2028", prophecy: "a sentence" });
    expect(order).toEqual(["switch", "simulate", "write"]);
    expect(simulateContract.mock.calls[0]?.[1]).toMatchObject({
      ...launchWrite({ slug: "lingo-2028", prophecy: "a sentence" }, MOCK_WORLD_LAUNCHPAD),
      chainId: 11_155_111,
    });
    expect(writeContract.mock.calls[0]?.[1]).toMatchObject({ chainId: 11_155_111 });
  });

  it("registerProphet carries chainId and runs the chain check first", async () => {
    const ensureChain = vi.fn(async () => undefined);
    const simulate = vi.fn(async () => ({}));
    const write = vi.fn(async () => `0x${"aa".repeat(32)}` as const);
    await createRegisterProphet(undefined, {
      address: MOCK_WORLD_LAUNCHPAD,
      simulateContract: simulate,
      writeContract: write,
      waitForTransactionReceipt: async () => ({ status: "success" }),
      ensureChain,
    })({ wallet: MOCK_WORLD_WALLET, label: "ringo", nullifier: MOCK_WORLD_VERIFY.nullifier, serverSig: MOCK_WORLD_VERIFY.serverSig });
    expect(ensureChain).toHaveBeenCalledTimes(1);
    expect(simulate.mock.calls[0]?.[1]).toMatchObject({ chainId: 11_155_111 });
    expect(write.mock.calls[0]?.[1]).toMatchObject({ chainId: 11_155_111 });
  });

  it("CCA writes (bid, claim, swap, approvals) carry chainId", async () => {
    const simulateContract = vi.fn(async () => ({}));
    const writeContract = vi.fn(async () => `0x${"aa".repeat(32)}` as const);
    await sendCcaWrite({ address: AUCTION, abi: ccaAbi, functionName: "checkpoint" }, "checkpoint", {
      simulateContract,
      writeContract,
      waitForTransactionReceipt: async () => ({ status: "success" }),
    });
    expect(simulateContract).toHaveBeenCalledWith(wagmiConfig, expect.objectContaining({ chainId: 11_155_111 }));
    expect(writeContract).toHaveBeenCalledWith(wagmiConfig, expect.objectContaining({ chainId: 11_155_111 }));
  });
});
