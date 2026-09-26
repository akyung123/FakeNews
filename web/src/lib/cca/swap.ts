/**
 * v4 swap after migrate. INTERFACE_CCA §4.7:
 *   Universal Router 2.1.2 `0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3`
 *   execute(commands, inputs, deadline), commands = V4_SWAP (0x10),
 *   actions = SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL (0x06, 0x0c, 0x0f),
 *   inputs[0] = abi.encode(actions, params).
 *
 * Pool key after a successful migrate: native ETH, token, fee 10000,
 * tickSpacing 200, hooks = ProphecyHook.
 */
import { encodeAbiParameters, encodePacked, zeroAddress, type Address, type Hex } from "viem";
import { CCA_SEPOLIA } from "./addresses";
import { POOL_FEE, POOL_TICK_SPACING } from "./config";
import {
  SETTLE_ALL,
  SWAP_EXACT_IN_SINGLE,
  TAKE_ALL,
  V4_SWAP_COMMAND,
  currencyAmountAbi,
  exactInputSingleParamsAbi,
  universalRouterAbi,
} from "./abi/universalRouter";
import { erc20Abi } from "../erc20Abi";
import { PERMIT2_MAX_EXPIRATION, permit2Abi } from "./abi/permit2";
import { sendCcaWrite, type CcaWriteOptions, type CcaWriteRequest } from "./writes";

const UINT128_MAX = (1n << 128n) - 1n;

/** `minHopPriceX36 = 0` disables the per-hop price check (§4.7). */
const NO_MIN_HOP_PRICE = 0n;

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

export function ethTokenPoolKey(
  token: Address,
  hooks: Address,
  fee = POOL_FEE,
  tickSpacing = POOL_TICK_SPACING,
): V4PoolKey {
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

function assertUint128(value: bigint, label: string): void {
  if (value < 0n || value > UINT128_MAX) {
    throw new Error(`${label} does not fit in uint128`);
  }
}

/**
 * The three action params, in action order.
 * Settle the currency going in, take the currency coming out (§4.7).
 */
export function encodeV4SwapActions(input: ExactInSingleInput): { actions: Hex; params: Hex[] } {
  const poolKey = ethTokenPoolKey(input.token, input.hooks, input.fee, input.tickSpacing);
  assertUint128(input.amountIn, "amountIn");
  assertUint128(input.amountOutMinimum, "amountOutMinimum");

  const currencyIn = input.zeroForOne ? poolKey.currency0 : poolKey.currency1;
  const currencyOut = input.zeroForOne ? poolKey.currency1 : poolKey.currency0;

  const actions = encodePacked(
    ["uint8", "uint8", "uint8"],
    [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL],
  );

  const swapParams = encodeAbiParameters(
    [exactInputSingleParamsAbi],
    [
      {
        poolKey,
        zeroForOne: input.zeroForOne,
        amountIn: input.amountIn,
        amountOutMinimum: input.amountOutMinimum,
        minHopPriceX36: NO_MIN_HOP_PRICE,
        hookData: input.hookData ?? "0x",
      },
    ],
  );

  const settleParams = encodeAbiParameters(currencyAmountAbi, [currencyIn, input.amountIn]);
  const takeParams = encodeAbiParameters(currencyAmountAbi, [currencyOut, input.amountOutMinimum]);

  return { actions, params: [swapParams, settleParams, takeParams] };
}

/** `execute(commands, inputs, deadline)` args plus the ETH value to send. */
export function encodeV4ExactInSingle(input: ExactInSingleInput): {
  commands: Hex;
  inputs: Hex[];
  deadline: bigint;
  value: bigint;
} {
  const { actions, params } = encodeV4SwapActions(input);
  const commands = encodePacked(["uint8"], [V4_SWAP_COMMAND]);
  const inputs = [encodeAbiParameters([{ type: "bytes" }, { type: "bytes[]" }], [actions, params])];
  return {
    commands,
    inputs,
    deadline: input.deadline,
    // ETH → token pays native ETH in. token → ETH sends none (§4.7).
    value: input.zeroForOne ? input.amountIn : 0n,
  };
}

export function swapExactInSingleWrite(input: ExactInSingleInput): CcaWriteRequest {
  const { commands, inputs, deadline, value } = encodeV4ExactInSingle(input);
  return {
    address: input.router ?? CCA_SEPOLIA.universalRouter,
    abi: universalRouterAbi,
    functionName: "execute",
    args: [commands, inputs, deadline],
    value,
  };
}

export async function swapExactInSingle(
  input: ExactInSingleInput,
  options: CcaWriteOptions = {},
): Promise<Hex> {
  return sendCcaWrite(swapExactInSingleWrite(input), "swap", options);
}

/** Step 1 of a sell: let Permit2 move this token. One time per token (§7.10). */
export function approvePermit2Write(token: Address, amount: bigint): CcaWriteRequest {
  return {
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [CCA_SEPOLIA.permit2, amount],
  };
}

/** Step 2 of a sell: let the router spend the token through Permit2 (§4.7). */
export function permit2ApproveRouterWrite(
  token: Address,
  amount: bigint,
  expiration: bigint,
  router: Address = CCA_SEPOLIA.universalRouter,
): CcaWriteRequest {
  if (amount < 0n || amount > (1n << 160n) - 1n) {
    throw new Error("permit2 amount does not fit in uint160");
  }
  if (expiration < 0n || expiration > PERMIT2_MAX_EXPIRATION) {
    throw new Error("permit2 expiration does not fit in uint48");
  }
  return {
    address: CCA_SEPOLIA.permit2,
    abi: permit2Abi,
    functionName: "approve",
    args: [token, router, amount, expiration],
  };
}

/** Read the router's current Permit2 allowance to decide which sell steps to show. */
export function permit2AllowanceRead(
  owner: Address,
  token: Address,
  router: Address = CCA_SEPOLIA.universalRouter,
) {
  return {
    address: CCA_SEPOLIA.permit2,
    abi: permit2Abi,
    functionName: "allowance",
    args: [owner, token, router],
  } as const;
}

export const universalRouterExecuteAbi = universalRouterAbi;
export const UNIVERSAL_ROUTER = CCA_SEPOLIA.universalRouter;
