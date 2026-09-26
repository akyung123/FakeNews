/**
 * v4 swap after migrate — INTERFACE_CCA §4.7 / §7.10 (PR #44).
 *
 * Universal Router 2.1.2 `0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3`
 *   commands = abi.encodePacked(uint8(0x10))           // V4_SWAP
 *   actions  = abi.encodePacked(uint8(0x06), 0x0c, 0x0f) // SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL
 *   inputs[0] = abi.encode(actions, params)
 *   ExactInputSingleParams is six fields; minHopPriceX36 = 0 disables the hop check.
 *
 * Encoding is isolated here. It has not been executed against live Sepolia 2.1.2.
 * Unit tests decode the calldata back and check every field.
 */
import {
  decodeAbiParameters,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  getAddress,
  maxUint160,
  maxUint48,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { CCA_SEPOLIA } from "./addresses";
import { POOL_FEE, POOL_TICK_SPACING } from "./config";
import { universalRouterAbi } from "./abi/universalRouter";
import { sendCcaWrite, type CcaWriteOptions, type CcaWriteRequest } from "./writes";

export const V4_SWAP_COMMAND = 0x10;
export const SWAP_EXACT_IN_SINGLE = 0x06;
export const SETTLE_ALL = 0x0c;
export const TAKE_ALL = 0x0f;

export const UNIVERSAL_ROUTER = CCA_SEPOLIA.universalRouter;
export const PERMIT2 = CCA_SEPOLIA.permit2;
export const universalRouterExecuteAbi = universalRouterAbi;

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
  minHopPriceX36?: bigint;
};

export type EncodedV4ExactInSingle = {
  router: Address;
  commands: Hex;
  inputs: Hex[];
  deadline: bigint;
  value: bigint;
  actions: Hex;
  params: Hex[];
  poolKey: V4PoolKey;
  zeroForOne: boolean;
  amountIn: bigint;
  amountOutMinimum: bigint;
  minHopPriceX36: bigint;
  hookData: Hex;
  settleCurrency: Address;
  settleMax: bigint;
  takeCurrency: Address;
  takeMin: bigint;
};

const poolKeyComponents = [
  { name: "currency0", type: "address" },
  { name: "currency1", type: "address" },
  { name: "fee", type: "uint24" },
  { name: "tickSpacing", type: "int24" },
  { name: "hooks", type: "address" },
] as const;

const exactInSingleComponents = [
  { name: "poolKey", type: "tuple", components: poolKeyComponents },
  { name: "zeroForOne", type: "bool" },
  { name: "amountIn", type: "uint128" },
  { name: "amountOutMinimum", type: "uint128" },
  { name: "minHopPriceX36", type: "uint256" },
  { name: "hookData", type: "bytes" },
] as const;

export const permit2Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  },
  { type: "error", name: "InsufficientAllowance", inputs: [{ name: "amount", type: "uint256" }] },
  { type: "error", name: "AllowanceExpired", inputs: [{ name: "deadline", type: "uint256" }] },
] as const;

export const erc20ApproveAbi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

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

export function v4SwapCommands(): Hex {
  return encodePacked(["uint8"], [V4_SWAP_COMMAND]);
}

export function v4SwapActions(): Hex {
  return encodePacked(["uint8", "uint8", "uint8"], [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]);
}

export function encodeV4ExactInSingle(input: ExactInSingleInput): EncodedV4ExactInSingle {
  const poolKey = ethTokenPoolKey(input.token, input.hooks, input.fee, input.tickSpacing);
  const hookData = input.hookData ?? "0x";
  const minHopPriceX36 = input.minHopPriceX36 ?? 0n;
  const settleCurrency = input.zeroForOne ? poolKey.currency0 : poolKey.currency1;
  const takeCurrency = input.zeroForOne ? poolKey.currency1 : poolKey.currency0;
  const actions = v4SwapActions();
  const swapParams = encodeAbiParameters(
    [{ type: "tuple", components: exactInSingleComponents }],
    [
      {
        poolKey,
        zeroForOne: input.zeroForOne,
        amountIn: input.amountIn,
        amountOutMinimum: input.amountOutMinimum,
        minHopPriceX36,
        hookData,
      },
    ],
  );
  const settleParams = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    [settleCurrency, input.amountIn],
  );
  const takeParams = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    [takeCurrency, input.amountOutMinimum],
  );
  const params = [swapParams, settleParams, takeParams];
  const inputs = [
    encodeAbiParameters([{ type: "bytes" }, { type: "bytes[]" }], [actions, params]),
  ];
  return {
    router: input.router ?? UNIVERSAL_ROUTER,
    commands: v4SwapCommands(),
    inputs,
    deadline: input.deadline,
    value: input.zeroForOne ? input.amountIn : 0n,
    actions,
    params,
    poolKey,
    zeroForOne: input.zeroForOne,
    amountIn: input.amountIn,
    amountOutMinimum: input.amountOutMinimum,
    minHopPriceX36,
    hookData,
    settleCurrency,
    settleMax: input.amountIn,
    takeCurrency,
    takeMin: input.amountOutMinimum,
  };
}

export function decodeV4ExactInSingle(encoded: Pick<EncodedV4ExactInSingle, "commands" | "inputs">): {
  command: number;
  actions: number[];
  poolKey: V4PoolKey;
  zeroForOne: boolean;
  amountIn: bigint;
  amountOutMinimum: bigint;
  minHopPriceX36: bigint;
  hookData: Hex;
  settleCurrency: Address;
  settleMax: bigint;
  takeCurrency: Address;
  takeMin: bigint;
} {
  if (encoded.commands !== v4SwapCommands()) {
    throw new Error("commands must be V4_SWAP 0x10");
  }
  if (encoded.inputs.length !== 1) {
    throw new Error("V4_SWAP expects a single input");
  }
  const [actions, params] = decodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    encoded.inputs[0]!,
  );
  if (actions !== v4SwapActions() || params.length !== 3) {
    throw new Error("actions must be 0x06,0x0c,0x0f with three params");
  }
  const [swap] = decodeAbiParameters(
    [{ type: "tuple", components: exactInSingleComponents }],
    params[0]!,
  );
  const [settleCurrency, settleMax] = decodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    params[1]!,
  );
  const [takeCurrency, takeMin] = decodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    params[2]!,
  );
  return {
    command: V4_SWAP_COMMAND,
    actions: [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL],
    poolKey: {
      currency0: getAddress(swap.poolKey.currency0),
      currency1: getAddress(swap.poolKey.currency1),
      fee: Number(swap.poolKey.fee),
      tickSpacing: Number(swap.poolKey.tickSpacing),
      hooks: getAddress(swap.poolKey.hooks),
    },
    zeroForOne: swap.zeroForOne,
    amountIn: swap.amountIn,
    amountOutMinimum: swap.amountOutMinimum,
    minHopPriceX36: swap.minHopPriceX36,
    hookData: swap.hookData,
    settleCurrency: getAddress(settleCurrency),
    settleMax,
    takeCurrency: getAddress(takeCurrency),
    takeMin,
  };
}

export function swapExactInSingleWrite(input: ExactInSingleInput): CcaWriteRequest {
  const encoded = encodeV4ExactInSingle(input);
  return {
    address: encoded.router,
    abi: universalRouterAbi,
    functionName: "execute",
    args: [encoded.commands, encoded.inputs, encoded.deadline],
    value: encoded.value,
  };
}

export function encodeUniversalRouterExecute(input: ExactInSingleInput): Hex {
  const request = swapExactInSingleWrite(input);
  return encodeFunctionData({
    abi: universalRouterAbi,
    functionName: "execute",
    args: [request.args![0] as Hex, request.args![1] as Hex[], request.args![2] as bigint],
  });
}

export async function swapExactInSingle(
  input: ExactInSingleInput,
  options: CcaWriteOptions = {},
): Promise<Hex> {
  return sendCcaWrite(swapExactInSingleWrite(input), "execute", options);
}

export function tokenApprovePermit2Write(token: Address, amount: bigint = maxUint160): CcaWriteRequest {
  return {
    address: token,
    abi: erc20ApproveAbi,
    functionName: "approve",
    args: [PERMIT2, amount],
  };
}

export function permit2ApproveRouterWrite(
  token: Address,
  amount: bigint = maxUint160,
  expiration: bigint = maxUint48,
  router: Address = UNIVERSAL_ROUTER,
): CcaWriteRequest {
  return {
    address: PERMIT2,
    abi: permit2Abi,
    functionName: "approve",
    args: [token, router, amount, expiration],
  };
}

export async function approveTokenForPermit2(
  token: Address,
  amount: bigint = maxUint160,
  options: CcaWriteOptions = {},
): Promise<Hex> {
  return sendCcaWrite(tokenApprovePermit2Write(token, amount), "approve", options);
}

export async function approvePermit2ForRouter(
  token: Address,
  amount: bigint = maxUint160,
  expiration: bigint = maxUint48,
  options: CcaWriteOptions = {},
  router: Address = UNIVERSAL_ROUTER,
): Promise<Hex> {
  return sendCcaWrite(permit2ApproveRouterWrite(token, amount, expiration, router), "permit2.approve", options);
}
