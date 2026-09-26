import { describe, expect, it, vi } from "vitest";
import { sepoliaRpcUrls, shareFor, withRpcRetry } from "./rpc";

describe("sepoliaRpcUrls", () => {
  it("puts the configured RPC first, then the public fallbacks, de-duplicated", () => {
    expect(sepoliaRpcUrls("https://my-key.example/rpc")).toEqual([
      "https://my-key.example/rpc",
      "https://sepolia.gateway.tenderly.co",
      "https://ethereum-sepolia-rpc.publicnode.com",
    ]);
  });

  it("never includes the dead rpc.sepolia.org endpoint", () => {
    expect(sepoliaRpcUrls(undefined)).not.toContain("https://rpc.sepolia.org");
    expect(sepoliaRpcUrls("https://rpc.sepolia.org")).toEqual(["https://rpc.sepolia.org", ...sepoliaRpcUrls(undefined)]);
  });

  it("drops a duplicate when the configured RPC is one of the public fallbacks", () => {
    expect(sepoliaRpcUrls("https://ethereum-sepolia-rpc.publicnode.com")).toEqual([
      "https://ethereum-sepolia-rpc.publicnode.com",
      "https://sepolia.gateway.tenderly.co",
    ]);
  });

  it("falls back to just the public endpoints when nothing is configured", () => {
    expect(sepoliaRpcUrls(undefined)).toEqual([
      "https://sepolia.gateway.tenderly.co",
      "https://ethereum-sepolia-rpc.publicnode.com",
    ]);
  });
});

describe("withRpcRetry", () => {
  it("returns the result on the first success, no retry", async () => {
    const run = vi.fn(async () => 42);
    await expect(withRpcRetry(run)).resolves.toBe(42);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("retries a 429 with backoff, then succeeds", async () => {
    let calls = 0;
    const run = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new Error("HTTP request failed. Status: 429");
      return "ok";
    });
    const sleeps: number[] = [];
    const result = await withRpcRetry(run, {
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    expect(result).toBe("ok");
    expect(run).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([500, 1000]);
  });

  it("gives up after the attempt cap and rethrows", async () => {
    const run = vi.fn(async () => {
      throw new Error("429 Too Many Requests");
    });
    await expect(
      withRpcRetry(run, { attempts: 2, sleep: async () => {} }),
    ).rejects.toThrow("429");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-rate-limit error", async () => {
    const run = vi.fn(async () => {
      throw new Error("execution reverted");
    });
    await expect(withRpcRetry(run, { sleep: async () => {} })).rejects.toThrow("execution reverted");
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe("shareFor", () => {
  it("shares one call within the window and reads again after it", async () => {
    let clock = 0;
    const run = vi.fn(async () => clock);
    const load = shareFor(12_000, run, () => clock);
    const [a, b] = await Promise.all([load(), load()]);
    expect([a, b]).toEqual([0, 0]);
    clock = 11_999;
    await expect(load()).resolves.toBe(0);
    expect(run).toHaveBeenCalledTimes(1);
    clock = 12_000;
    await expect(load()).resolves.toBe(12_000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("does not keep a failed call", async () => {
    const run = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("429 Too Many Requests"))
      .mockResolvedValueOnce("ok");
    const load = shareFor(12_000, run, () => 0);
    await expect(load()).rejects.toThrow("429");
    await expect(load()).resolves.toBe("ok");
    expect(run).toHaveBeenCalledTimes(2);
  });
});
