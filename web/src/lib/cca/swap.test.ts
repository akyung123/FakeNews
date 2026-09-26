import { describe, expect, it } from "vitest";
import { decodeFunctionData, getAddress, parseEther, zeroAddress } from "viem";
import {
  PERMIT2,
  SETTLE_ALL,
  SWAP_EXACT_IN_SINGLE,
  TAKE_ALL,
  UNIVERSAL_ROUTER,
  V4_SWAP_COMMAND,
  decodeV4ExactInSingle,
  encodeUniversalRouterExecute,
  encodeV4ExactInSingle,
  ethTokenPoolKey,
  permit2ApproveRouterWrite,
  swapExactInSingleWrite,
  tokenApprovePermit2Write,
  universalRouterExecuteAbi,
  v4SwapActions,
  v4SwapCommands,
} from "./swap";
import { POOL_FEE, POOL_TICK_SPACING } from "./config";

const TOKEN = "0xa555555555555555555555555555555555555555" as const;
const HOOKS = "0xb666666666666666666666666666666666666666" as const;

describe("v4 swap encoding (UR 2.1.2)", () => {
  it("encodes ETH→token and decodes every field", () => {
    const input = {
      token: TOKEN,
      hooks: HOOKS,
      zeroForOne: true,
      amountIn: parseEther("0.001"),
      amountOutMinimum: 2n,
      deadline: 1_800_000_000n,
      hookData: "0x" as const,
    };
    const encoded = encodeV4ExactInSingle(input);
    expect(encoded.commands).toBe(v4SwapCommands());
    expect(encoded.commands).toBe("0x10");
    expect(encoded.actions).toBe(v4SwapActions());
    expect(encoded.actions).toBe("0x060c0f");
    expect(encoded.inputs).toHaveLength(1);
    expect(encoded.value).toBe(input.amountIn);
    expect(encoded.router).toBe(UNIVERSAL_ROUTER);

    const decoded = decodeV4ExactInSingle(encoded);
    expect(decoded.command).toBe(V4_SWAP_COMMAND);
    expect(decoded.actions).toEqual([SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]);
    expect(decoded.poolKey).toEqual({
      currency0: zeroAddress,
      currency1: getAddress(TOKEN),
      fee: POOL_FEE,
      tickSpacing: POOL_TICK_SPACING,
      hooks: getAddress(HOOKS),
    });
    expect(decoded.zeroForOne).toBe(true);
    expect(decoded.amountIn).toBe(input.amountIn);
    expect(decoded.amountOutMinimum).toBe(2n);
    expect(decoded.minHopPriceX36).toBe(0n);
    expect(decoded.hookData).toBe("0x");
    expect(decoded.settleCurrency).toBe(zeroAddress);
    expect(decoded.settleMax).toBe(input.amountIn);
    expect(decoded.takeCurrency).toBe(getAddress(TOKEN));
    expect(decoded.takeMin).toBe(2n);
  });

  it("encodes token→ETH with msg.value 0 and swapped settle/take", () => {
    const input = {
      token: TOKEN,
      hooks: HOOKS,
      zeroForOne: false,
      amountIn: 5n * 10n ** 18n,
      amountOutMinimum: parseEther("0.002"),
      deadline: 99n,
    };
    const encoded = encodeV4ExactInSingle(input);
    expect(encoded.value).toBe(0n);
    const decoded = decodeV4ExactInSingle(encoded);
    expect(decoded.zeroForOne).toBe(false);
    expect(decoded.settleCurrency).toBe(getAddress(TOKEN));
    expect(decoded.settleMax).toBe(input.amountIn);
    expect(decoded.takeCurrency).toBe(zeroAddress);
    expect(decoded.takeMin).toBe(input.amountOutMinimum);
    expect(decoded.poolKey).toEqual({
      ...ethTokenPoolKey(TOKEN, HOOKS),
      currency1: getAddress(TOKEN),
      hooks: getAddress(HOOKS),
    });
    expect(decoded.minHopPriceX36).toBe(0n);
  });

  it("round-trips execute calldata through the Universal Router ABI", () => {
    const input = {
      token: TOKEN,
      hooks: HOOKS,
      zeroForOne: true,
      amountIn: 11n,
      amountOutMinimum: 7n,
      deadline: 42n,
    };
    const data = encodeUniversalRouterExecute(input);
    const decoded = decodeFunctionData({ abi: universalRouterExecuteAbi, data });
    expect(decoded.functionName).toBe("execute");
    const [commands, inputs, deadline] = decoded.args as [`0x${string}`, `0x${string}`[], bigint];
    expect(commands).toBe("0x10");
    expect(deadline).toBe(42n);
    expect(inputs).toHaveLength(1);
    const fields = decodeV4ExactInSingle({ commands, inputs });
    expect(fields.amountIn).toBe(11n);
    expect(fields.amountOutMinimum).toBe(7n);
    expect(fields.poolKey.fee).toBe(10_000);
    expect(fields.poolKey.tickSpacing).toBe(200);
    expect(fields.poolKey.hooks).toBe(getAddress(HOOKS));
    expect(fields.actions).toEqual([0x06, 0x0c, 0x0f]);

    const request = swapExactInSingleWrite(input);
    expect(request.address).toBe(UNIVERSAL_ROUTER);
    expect(request.functionName).toBe("execute");
    expect(request.value).toBe(11n);
  });

  it("builds Permit2 approvals for token→ETH", () => {
    expect(tokenApprovePermit2Write(TOKEN).args).toEqual([PERMIT2, expect.any(BigInt)]);
    expect(permit2ApproveRouterWrite(TOKEN).address).toBe(PERMIT2);
    expect(permit2ApproveRouterWrite(TOKEN).args?.[1]).toBe(UNIVERSAL_ROUTER);
  });
});
