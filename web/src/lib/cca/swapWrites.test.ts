import { describe, expect, it } from "vitest";
import { decodeFunctionData, encodeFunctionData, type Address } from "viem";
import { CCA_SEPOLIA } from "./addresses";
import { permit2Abi } from "./abi/permit2";
import { universalRouterAbi, V4_SWAP_COMMAND } from "./abi/universalRouter";
import { erc20Abi } from "../erc20Abi";
import {
  createSwap,
  minOutFromQuote,
  readSellSteps,
  readSwapQuote,
  SwapWalletError,
  type SwapOptions,
  type SwapPhase,
} from "./swapWrites";

const TOKEN = "0x1111111111111111111111111111111111111111" as Address;
const HOOK = "0x2222222222222222222222222222222222222222" as Address;
const OWNER = "0x3333333333333333333333333333333333333333" as Address;
const NOW = 1_800_000_000;

/** sqrtPriceX96 for 1e9 tokens per ETH: sqrt(1e9) * 2^96. */
const SQRT_PRICE = 2_505_414_483_750_479_311_864_138_015_696_359n;

type Sent = { address: Address; functionName: string; args: readonly unknown[]; value?: bigint };

function recorder(overrides: Partial<SwapOptions> = {}) {
  const sent: Sent[] = [];
  const phases: SwapPhase[] = [];
  const options: SwapOptions = {
    simulateContract: (async (_config: unknown, request: Sent) => ({ request })) as never,
    writeContract: (async (_config: unknown, request: Sent) => {
      sent.push(request);
      return "0xhash";
    }) as never,
    waitForTransactionReceipt: (async () => ({ status: "success" })) as never,
    getAccount: () => ({ address: OWNER }),
    nowSeconds: () => NOW,
    ...overrides,
  };
  return { sent, phases, options };
}

/** Allowances high enough that a sell needs no Permit2 step. */
function allowingReads(amount = 10n ** 30n, expiration = NOW + 86_400) {
  return (async (_config: unknown, request: { abi: unknown; functionName: string }) => {
    if (request.abi === erc20Abi && request.functionName === "allowance") return amount;
    if (request.abi === permit2Abi && request.functionName === "allowance") {
      return [amount, expiration, 0] as const;
    }
    throw new Error(`unexpected read ${request.functionName}`);
  }) as never;
}

describe("v4 swap writes", () => {
  it("buys with one router call that carries the ETH", async () => {
    const { sent, phases, options } = recorder();
    const swap = createSwap(options);

    const ok = await swap({
      token: TOKEN,
      hooks: HOOK,
      zeroForOne: true,
      amountIn: 10n ** 15n,
      amountOutMinimum: 1n,
      onPhase: (phase) => phases.push(phase),
    });

    expect(ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].address).toBe(CCA_SEPOLIA.universalRouter);
    expect(sent[0].functionName).toBe("execute");
    expect(sent[0].value).toBe(10n ** 15n);
    // No Permit2 approval is asked for when the trader pays native ETH.
    expect(phases).toEqual(["wallet", "waiting"]);
  });

  it("encodes the buy as the V4_SWAP command with a future deadline", async () => {
    const { sent, options } = recorder();
    await createSwap(options)({
      token: TOKEN,
      hooks: HOOK,
      zeroForOne: true,
      amountIn: 10n ** 15n,
      amountOutMinimum: 1n,
    });

    const [commands, inputs, deadline] = sent[0].args as [string, string[], bigint];
    expect(commands).toBe(`0x${V4_SWAP_COMMAND.toString(16).padStart(2, "0")}`);
    expect(inputs).toHaveLength(1);
    expect(deadline).toBeGreaterThan(BigInt(NOW));
  });

  it("takes the two Permit2 steps before a first sell, then swaps with no value", async () => {
    const { sent, phases, options } = recorder({ readContract: allowingReads(0n, 0) });

    await createSwap(options)({
      token: TOKEN,
      hooks: HOOK,
      zeroForOne: false,
      amountIn: 10n ** 18n,
      amountOutMinimum: 1n,
      onPhase: (phase) => phases.push(phase),
    });

    expect(sent).toHaveLength(3);

    expect(sent[0].address).toBe(TOKEN);
    expect(sent[0].functionName).toBe("approve");
    expect(sent[0].args[0]).toBe(CCA_SEPOLIA.permit2);

    expect(sent[1].address).toBe(CCA_SEPOLIA.permit2);
    expect(sent[1].functionName).toBe("approve");
    expect(sent[1].args.slice(0, 2)).toEqual([TOKEN, CCA_SEPOLIA.universalRouter]);
    expect(sent[1].args[3]).toBeGreaterThan(BigInt(NOW));

    expect(sent[2].address).toBe(CCA_SEPOLIA.universalRouter);
    expect(sent[2].value ?? 0n).toBe(0n);

    expect(phases).toEqual(["allow", "waiting", "confirm", "waiting", "wallet", "waiting"]);
  });

  it("skips both Permit2 steps when the allowances already cover the sale", async () => {
    const { sent, options } = recorder({ readContract: allowingReads() });

    await createSwap(options)({
      token: TOKEN,
      hooks: HOOK,
      zeroForOne: false,
      amountIn: 10n ** 18n,
      amountOutMinimum: 1n,
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].address).toBe(CCA_SEPOLIA.universalRouter);
  });

  it("re-confirms Permit2 when the allowance has expired", async () => {
    const { sent, options } = recorder({ readContract: allowingReads(10n ** 30n, NOW - 1) });

    await createSwap(options)({
      token: TOKEN,
      hooks: HOOK,
      zeroForOne: false,
      amountIn: 10n ** 18n,
      amountOutMinimum: 1n,
    });

    expect(sent.map((call) => call.address)).toEqual([
      CCA_SEPOLIA.permit2,
      CCA_SEPOLIA.universalRouter,
    ]);
  });

  it("asks for a wallet before a sell instead of sending", async () => {
    const { sent, options } = recorder({ getAccount: () => ({}) });

    await expect(
      createSwap(options)({
        token: TOKEN,
        hooks: HOOK,
        zeroForOne: false,
        amountIn: 10n ** 18n,
        amountOutMinimum: 1n,
      }),
    ).rejects.toBeInstanceOf(SwapWalletError);
    expect(sent).toHaveLength(0);
  });

  it("throws when the swap reverts on chain", async () => {
    const { options } = recorder({
      waitForTransactionReceipt: (async () => ({ status: "reverted" })) as never,
    });

    await expect(
      createSwap(options)({
        token: TOKEN,
        hooks: HOOK,
        zeroForOne: true,
        amountIn: 10n ** 15n,
        amountOutMinimum: 1n,
      }),
    ).rejects.toThrow(/did not succeed/);
  });

  it("sends nothing for a zero amount", async () => {
    const { sent, options } = recorder();
    expect(
      await createSwap(options)({
        token: TOKEN,
        hooks: HOOK,
        zeroForOne: true,
        amountIn: 0n,
        amountOutMinimum: 0n,
      }),
    ).toBe(false);
    expect(sent).toHaveLength(0);
  });
});

describe("swap quotes", () => {
  it("prefers the Quoter result", async () => {
    const quoted = await readSwapQuote(
      { token: TOKEN, hooks: HOOK, zeroForOne: true, amountIn: 10n ** 15n },
      SQRT_PRICE,
      { simulateContract: (async () => ({ result: [12345n, 0n] })) as never },
    );
    expect(quoted).toBe(12345n);
  });

  it("falls back to spot price when the Quoter is unreachable", async () => {
    const amountIn = 10n ** 15n;
    const quoted = await readSwapQuote(
      { token: TOKEN, hooks: HOOK, zeroForOne: true, amountIn },
      SQRT_PRICE,
      {
        simulateContract: (async () => {
          throw new Error("no pool");
        }) as never,
      },
    );
    // 1e9 tokens per ETH, less the 1% pool fee.
    expect(quoted).toBeGreaterThan(0n);
    expect(quoted).toBeLessThan((amountIn * 10n ** 9n * 100n) / 99n);
  });

  it("returns zero when there is no price to fall back to", async () => {
    const quoted = await readSwapQuote(
      { token: TOKEN, hooks: HOOK, zeroForOne: true, amountIn: 10n ** 15n },
      undefined,
      {
        simulateContract: (async () => {
          throw new Error("no pool");
        }) as never,
      },
    );
    expect(quoted).toBe(0n);
  });

  it("floors the quote by 1% for amountOutMinimum", () => {
    expect(minOutFromQuote(10_000n)).toBe(9_900n);
    expect(minOutFromQuote(0n)).toBe(0n);
  });
});

describe("sell steps", () => {
  it("reports both steps when there is no wallet", async () => {
    const steps = await readSellSteps(TOKEN, 1n, { getAccount: () => ({}) });
    expect(steps).toEqual({ needsAllow: true, needsConfirm: true });
  });

  it("reads the router allowance through Permit2", async () => {
    const reads: string[] = [];
    const steps = await readSellSteps(TOKEN, 10n ** 18n, {
      getAccount: () => ({ address: OWNER }),
      nowSeconds: () => NOW,
      readContract: (async (_config: unknown, request: { address: Address; args: unknown[] }) => {
        reads.push(request.address);
        return request.address === TOKEN ? 10n ** 30n : ([10n ** 30n, NOW + 60, 0] as const);
      }) as never,
    });
    expect(reads).toEqual([TOKEN, CCA_SEPOLIA.permit2]);
    expect(steps).toEqual({ owner: OWNER, needsAllow: false, needsConfirm: false });
  });
});

describe("router call shape", () => {
  it("round-trips through the official Universal Router ABI", async () => {
    const { sent, options } = recorder();
    await createSwap(options)({
      token: TOKEN,
      hooks: HOOK,
      zeroForOne: true,
      amountIn: 10n ** 15n,
      amountOutMinimum: 1n,
    });

    const decoded = decodeFunctionData({
      abi: universalRouterAbi,
      data: encodeFunctionData({
        abi: universalRouterAbi,
        functionName: "execute",
        args: sent[0].args as never,
      }),
    });
    expect(decoded.functionName).toBe("execute");
    expect(decoded.args).toEqual(sent[0].args);
  });
});
