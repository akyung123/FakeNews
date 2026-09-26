/**
 * Source: INTERFACE_CCA.md §4.7 (PR #40 head b02a445).
 * `execute(commands, inputs, deadline)` plus the listed errors are specified.
 * Universal Router **2.1.2** Sepolia: `0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3`.
 *
 * V4_SWAP = 0x10; actions 0x06 / 0x0c / 0x0f. Encoding lives in swap.ts.
 *
 * https://github.com/Uniswap/universal-router/blob/main/contracts/interfaces/IUniversalRouter.sol
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

/**
 * UR 2.0 research constants. INTERFACE_CCA §4.7 / §10.14 marks 2.1.2
 * command bytes TBD(INTERFACE_CCA). Do not send these on the product path.
 */
export const V4_SWAP_COMMAND = 0x10;
export const SWAP_EXACT_IN_SINGLE = 0x06;
export const SETTLE_ALL = 0x0c;
export const TAKE_ALL = 0x0f;
