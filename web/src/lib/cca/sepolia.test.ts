import { describe, expect, it, vi } from "vitest";
import { SEPOLIA_CHAIN_ID } from "../env";
import {
  SEPOLIA_ADD_CHAIN_PARAMS,
  SEPOLIA_HEX_CHAIN_ID,
  ensureSepoliaChain,
  injectedProvider,
  isSepoliaChainId,
  isUnrecognizedChainError,
  parseProviderChainId,
  type Eip1193Provider,
} from "./sepolia";

function provider(request: Eip1193Provider["request"]): Eip1193Provider {
  return { request };
}

describe("Sepolia EIP-1193 gate", () => {
  it("parses hex and decimal chain ids", () => {
    expect(parseProviderChainId("0xaa36a7")).toBe(SEPOLIA_CHAIN_ID);
    expect(parseProviderChainId(SEPOLIA_CHAIN_ID)).toBe(SEPOLIA_CHAIN_ID);
    expect(parseProviderChainId("11155111")).toBe(SEPOLIA_CHAIN_ID);
    expect(parseProviderChainId("0x1")).toBe(1);
    expect(parseProviderChainId("")).toBeUndefined();
    expect(isSepoliaChainId(SEPOLIA_CHAIN_ID)).toBe(true);
    expect(isSepoliaChainId(1)).toBe(false);
  });

  it("treats only 4902 as an unrecognized-chain error", () => {
    expect(isUnrecognizedChainError({ code: 4902 })).toBe(true);
    expect(isUnrecognizedChainError({ code: "4902" })).toBe(true);
    expect(isUnrecognizedChainError({ code: 4001 })).toBe(false);
    expect(isUnrecognizedChainError("4902")).toBe(false);
  });

  it("returns true when the injected wallet is already on Sepolia", async () => {
    const request = vi.fn(async ({ method }: { method: string }) => {
      expect(method).toBe("eth_chainId");
      return SEPOLIA_HEX_CHAIN_ID;
    });
    await expect(ensureSepoliaChain(provider(request))).resolves.toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("switches to Sepolia when the wallet is on another chain", async () => {
    const seen: string[] = [];
    const request = vi.fn(async ({ method }: { method: string }) => {
      seen.push(method);
      if (method === "eth_chainId") return seen.includes("wallet_switchEthereumChain") ? SEPOLIA_HEX_CHAIN_ID : "0x1";
      return null;
    });
    await expect(ensureSepoliaChain(provider(request))).resolves.toBe(true);
    expect(seen).toEqual(["eth_chainId", "wallet_switchEthereumChain", "eth_chainId"]);
    expect(request).toHaveBeenCalledWith({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_HEX_CHAIN_ID }],
    });
  });

  it("adds Sepolia on 4902, then switches", async () => {
    const seen: string[] = [];
    const request = vi.fn(async ({ method }: { method: string }) => {
      seen.push(method);
      if (method === "eth_chainId") {
        return seen.includes("wallet_addEthereumChain") ? SEPOLIA_HEX_CHAIN_ID : "0x1";
      }
      if (method === "wallet_switchEthereumChain" && !seen.includes("wallet_addEthereumChain")) {
        throw { code: 4902 };
      }
      return null;
    });
    await expect(ensureSepoliaChain(provider(request))).resolves.toBe(true);
    expect(seen).toEqual([
      "eth_chainId",
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain",
      "wallet_switchEthereumChain",
      "eth_chainId",
    ]);
    expect(request).toHaveBeenCalledWith({
      method: "wallet_addEthereumChain",
      params: [SEPOLIA_ADD_CHAIN_PARAMS],
    });
  });

  it("does not add the chain on a user-rejected switch", async () => {
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === "eth_chainId") return "0x1";
      if (method === "wallet_switchEthereumChain") throw { code: 4001 };
      throw new Error(`unexpected ${method}`);
    });
    await expect(ensureSepoliaChain(provider(request))).resolves.toBe(false);
    expect(request.mock.calls.map((call) => call[0].method)).toEqual(["eth_chainId", "wallet_switchEthereumChain"]);
  });

  it("returns false when no injected provider is present", async () => {
    await expect(ensureSepoliaChain(undefined)).resolves.toBe(false);
    expect(injectedProvider({})).toBeUndefined();
  });
});
