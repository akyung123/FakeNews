/**
 * Uniswap v4 exact-in single-hop via Universal Router 2.0.
 * Encoding follows the official routing guide:
 *   V4_SWAP + SWAP_EXACT_IN_SINGLE + SETTLE_ALL + TAKE_ALL
 *   https://developers.uniswap.org/docs/protocols/v4/guides/swapping/routing
 *
 * ExactInputSingleParams is the UR 2.0 five-field struct (no minHopPriceX36).
 * ETH in is `msg.value`. ERC20 in needs a Permit2 allowance on the router
 * (not invented here — caller supplies it).
 */
import {
  encodeAbiParameters,
  encodePacked,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { CCA_SEPOLIA } from "./addresses";
import { POOL_FEE, POOL_TICK_SPACING } from "./constants";
import {
  SETTLE_ALL,
  SWAP_EXACT_IN_SINGLE,
  TAKE_ALL,
  V4_SWAP_COMMAND,
  universalRouterAbi,
} from "./abi/universalRouter";
import { sendCcaWrite, type CcaWriteOptions, type CcaWriteRequest } from "./writes";

export type V4PoolKey = {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
};

export type ExactInSingleInput = {
  token: Address;
  hooks: Address;
  /** true = ETH → token (currency0 → currency1). false = token → ETH. */
  zeroForOne: boolean;
  amountIn: bigint;
  amountOutMinimum: bigint;
  deadline: bigint;
  fee?: number;
  tickSpacing?: number;
  hookData?: Hex;
  router?: Address;
};

export function ethTokenPoolKey(token: Address, hooks: Address, fee = POOL_FEE, tickSpacing = POOL_TICK_SPACING): V4PoolKey {
  if (token === zeroAddress) {
    throw new Error("token cannot be native ETH");
  }
  return {
    currency0: zeroAddress,
    currency1: token,
    fee,
    tickSpacing,
    hooks,
  };
}

export function encodeV4ExactInSingle(input: ExactInSingleInput): {
  commands: Hex;
  inputs: Hex[];
  value: bigint;
  poolKey: V4PoolKey;
} {
  const poolKey = ethTokenPoolKey(
    input.token,
    input.hooks,
    input.fee ?? POOL_FEE,
    input.tickSpacing ?? POOL_TICK_SPACING,
  );
  const hookData = input.hookData ?? "0x";
  const currencyIn = input.zeroForOne ? poolKey.currency0 : poolKey.currency1;
  const currencyOut = input.zeroForOne ? poolKey.currency1 : poolKey.currency0;

  const swapParams = encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          {
            name: "poolKey",
            type: "tuple",
            components: [
              { name: "currency0", type: "address" },
              { name: "currency1", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "tickSpacing", type: "int24" },
              { name: "hooks", type: "address" },
            ],
          },
          { name: "zeroForOne", type: "bool" },
          { name: "amountIn", type: "uint128" },
          { name: "amountOutMinimum", type: "uint128" },
          { name: "hookData", type: "bytes" },
        ],
      },
    ],
    [
      {
        poolKey,
        zeroForOne: input.zeroForOne,
        amountIn: input.amountIn,
        amountOutMinimum: input.amountOutMinimum,
        hookData,
      },
    ],
  );

  const settle = encodeAbiParameters(
    [
      { name: "currency", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    [currencyIn, input.amountIn],
  );
  const take = encodeAbiParameters(
    [
      { name: "currency", type: "address" },
      { name: "minAmount", type: "uint256" },
    ],
    [currencyOut, input.amountOutMinimum],
  );

  const actions = encodePacked(
    ["uint8", "uint8", "uint8"],
    [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL],
  );
  const commands = encodePacked(["uint8"], [V4_SWAP_COMMAND]);
  const packed = encodeAbiParameters(
    [
      { name: "actions", type: "bytes" },
      { name: "params", type: "bytes[]" },
    ],
    [actions, [swapParams, settle, take]],
  );

  return {
    commands,
    inputs: [packed],
    value: input.zeroForOne ? input.amountIn : 0n,
    poolKey,
  };
}

export function swapExactInSingleWrite(input: ExactInSingleInput): CcaWriteRequest {
  const encoded = encodeV4ExactInSingle(input);
  return {
    address: input.router ?? CCA_SEPOLIA.universalRouter,
    abi: universalRouterAbi,
    functionName: "execute",
    args: [encoded.commands, encoded.inputs, input.deadline],
    value: encoded.value,
  };
}

export async function swapExactInSingle(input: ExactInSingleInput, options: CcaWriteOptions = {}): Promise<Hex> {
  return sendCcaWrite(swapExactInSingleWrite(input), "execute", options);
}
