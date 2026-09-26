/**
 * v4 swap after migrate. INTERFACE_CCA §4.7:
 *   Address = Universal Router 2.1.2 `0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3`
 *   `execute(commands, inputs, deadline)` is specified.
 *   V4_SWAP command + inputs encoding is TBD(INTERFACE_CCA) — do not invent ids.
 *
 * Pool key after a successful migrate: native ETH, token, fee 10000,
 * tickSpacing 200, hooks = ProphecyHook.
 */
import { zeroAddress, type Address, type Hex } from "viem";
import { CCA_SEPOLIA } from "./addresses";
import { POOL_FEE, POOL_TICK_SPACING } from "./config";
import { InterfaceCcaPendingError } from "./launchpadCca";
import { universalRouterAbi } from "./abi/universalRouter";
import type { CcaWriteRequest } from "./writes";

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

/** TBD(INTERFACE_CCA) §10.14 — do not invent Universal Router 2.1.2 command bytes. */
export function encodeV4ExactInSingle(_input: ExactInSingleInput): never {
  throw new InterfaceCcaPendingError("Universal Router 2.1.2 V4_SWAP command + inputs encoding");
}

/** TBD until command bytes are copied from the 2.1.2 pin. */
export function swapExactInSingleWrite(_input: ExactInSingleInput): CcaWriteRequest {
  return encodeV4ExactInSingle(_input);
}

export async function swapExactInSingle(_input: ExactInSingleInput): Promise<Hex> {
  return encodeV4ExactInSingle(_input);
}

export const universalRouterExecuteAbi = universalRouterAbi;
export const UNIVERSAL_ROUTER = CCA_SEPOLIA.universalRouter;
