import { describe, expect, it } from "vitest";
import { parseEther, zeroAddress } from "viem";
import { POOL_FEE, POOL_TICK_SPACING } from "./config";
import {
  ethPerTokenWei,
  isPoolOpen,
  minOutForSlippage,
  poolIdForToken,
  poolMarketCapWei,
  quoteExactInRequest,
  quoteFromSpotPrice,
  slot0Request,
  swapDeadline,
  tokensPerEthWei,
} from "./pool";
import { CCA_SEPOLIA } from "./addresses";
import { v4PoolId } from "../graduation";

const TOKEN = "0xa555555555555555555555555555555555555555" as const;
const HOOKS = "0x1600059B95A80d500fC42400ea9a88A9C29D2000" as const;

/** sqrtPriceX96 for a pool holding `ethWei` against `tokenWei`. */
function sqrtPriceFor(ethWei: bigint, tokenWei: bigint): bigint {
  // price = token/eth, sqrtPriceX96 = sqrt(price) * 2^96
  const ratioX192 = (tokenWei << 192n) / ethWei;
  let x = ratioX192;
  let root = 1n;
  while (x > 1n) {
    x >>= 2n;
    root <<= 1n;
  }
  for (let i = 0; i < 200; i++) {
    root = (root + ratioX192 / root) >> 1n;
  }
  return root;
}

describe("v4 pool reads", () => {
  it("derives the same pool id as the curve graduation helper", () => {
    expect(poolIdForToken(TOKEN, HOOKS)).toBe(v4PoolId({ token: TOKEN, hooks: HOOKS }));
  });

  it("points slot0 at the pinned StateView", () => {
    const request = slot0Request(poolIdForToken(TOKEN, HOOKS));
    expect(request.address).toBe(CCA_SEPOLIA.stateView);
    expect(request.functionName).toBe("getSlot0");
  });

  it("treats an uninitialized pool as closed", () => {
    expect(isPoolOpen(0n)).toBe(false);
    expect(isPoolOpen(undefined)).toBe(false);
    expect(isPoolOpen(1n)).toBe(true);
  });

  it("reads ETH per token off the pool price", () => {
    // 10 ETH against 1000 tokens => 0.01 ETH per token, 100 tokens per ETH.
    const sqrtPriceX96 = sqrtPriceFor(parseEther("10"), parseEther("1000"));
    const perToken = ethPerTokenWei(sqrtPriceX96);
    const perEth = tokensPerEthWei(sqrtPriceX96);

    expect(Number(perToken) / 1e18).toBeCloseTo(0.01, 6);
    expect(Number(perEth) / 1e18).toBeCloseTo(100, 4);
    expect(ethPerTokenWei(0n)).toBe(0n);
    expect(tokensPerEthWei(0n)).toBe(0n);
  });

  it("prices a fixed supply at the pool price", () => {
    const sqrtPriceX96 = sqrtPriceFor(parseEther("10"), parseEther("1000"));
    const cap = poolMarketCapWei(sqrtPriceX96, parseEther("1000000000"));
    // 0.01 ETH per token * 1e9 tokens
    expect(Number(cap) / 1e18).toBeCloseTo(10_000_000, 0);
  });

  it("estimates a swap from spot and takes the pool fee off the way in", () => {
    const sqrtPriceX96 = sqrtPriceFor(parseEther("10"), parseEther("1000"));
    // 1 ETH in, 1% fee, 100 tokens per ETH => about 99 tokens.
    const buy = quoteFromSpotPrice(sqrtPriceX96, true, parseEther("1"));
    expect(Number(buy) / 1e18).toBeCloseTo(99, 2);

    // 100 tokens in at 0.01 ETH each, less 1% => about 0.99 ETH.
    const sell = quoteFromSpotPrice(sqrtPriceX96, false, parseEther("100"));
    expect(Number(sell) / 1e18).toBeCloseTo(0.99, 4);

    expect(quoteFromSpotPrice(0n, true, parseEther("1"))).toBe(0n);
    expect(quoteFromSpotPrice(sqrtPriceX96, true, 0n)).toBe(0n);
  });

  it("floors the output by slippage", () => {
    expect(minOutForSlippage(1000n, 100n)).toBe(990n);
    expect(minOutForSlippage(1000n, 0n)).toBe(1000n);
    expect(minOutForSlippage(0n, 100n)).toBe(0n);
  });

  it("quotes through the pinned Quoter with the migrate pool key", () => {
    const request = quoteExactInRequest({
      token: TOKEN,
      hooks: HOOKS,
      zeroForOne: true,
      amountIn: parseEther("0.01"),
    });
    expect(request.address).toBe(CCA_SEPOLIA.quoter);
    expect(request.functionName).toBe("quoteExactInputSingle");
    expect(request.args[0].poolKey).toEqual({
      currency0: zeroAddress,
      currency1: TOKEN,
      fee: POOL_FEE,
      tickSpacing: POOL_TICK_SPACING,
      hooks: HOOKS,
    });
    expect(request.args[0].exactAmount).toBe(parseEther("0.01"));
    expect(request.args[0].hookData).toBe("0x");
  });

  it("puts the swap deadline in the future", () => {
    expect(swapDeadline(1_000, 600)).toBe(1_600n);
  });
});
