/**
 * Source: Uniswap/universal-router + official v4 swap routing guide
 * Tag: 2.0.0
 * URLs:
 *   https://github.com/Uniswap/universal-router/blob/2.0.0/contracts/interfaces/IUniversalRouter.sol
 *   https://github.com/Uniswap/universal-router/blob/main/contracts/libraries/Commands.sol
 *   https://github.com/Uniswap/v4-periphery/blob/main/src/libraries/Actions.sol
 *   https://developers.uniswap.org/docs/protocols/v4/guides/swapping/routing
 *   https://developers.uniswap.org/docs/protocols/v4/deployments
 *
 * Sepolia path used here: Universal Router 2.0 `execute(commands, inputs, deadline)`
 * with command `V4_SWAP` (0x10) and actions
 * `SWAP_EXACT_IN_SINGLE` (0x06) + `SETTLE_ALL` (0x0c) + `TAKE_ALL` (0x0f).
 *
 * ExactInputSingleParams encoding matches the official routing guide
 * (poolKey, zeroForOne, amountIn, amountOutMinimum, hookData) — UR 2.0
 * does not take `minHopPriceX36` (that field is UR 2.1.1+).
 *
 * Only functions / errors verified in those sources. No invented names.
 */
export const universalRouterAbi = [
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      { name: "commands", type: "bytes" },
      { name: "inputs", type: "bytes[]" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "error",
    name: "ExecutionFailed",
    inputs: [
      { name: "commandIndex", type: "uint256" },
      { name: "message", type: "bytes" },
    ],
  },
  { type: "error", name: "ETHNotAccepted", inputs: [] },
  { type: "error", name: "TransactionDeadlinePassed", inputs: [] },
  { type: "error", name: "LengthMismatch", inputs: [] },
  { type: "error", name: "InvalidEthSender", inputs: [] },
] as const;

/** Commands.V4_SWAP — Uniswap/universal-router `contracts/libraries/Commands.sol`. */
export const V4_SWAP_COMMAND = 0x10;

/** Actions — Uniswap/v4-periphery `src/libraries/Actions.sol`. */
export const SWAP_EXACT_IN_SINGLE = 0x06;
export const SETTLE_ALL = 0x0c;
export const TAKE_ALL = 0x0f;
