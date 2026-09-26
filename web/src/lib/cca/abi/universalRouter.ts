/**
 * Source: INTERFACE_CCA.md §4.7.
 * `execute(commands, inputs, deadline)` plus the listed errors are specified.
 * Universal Router **2.1.2** Sepolia: `0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3`.
 *
 * https://github.com/Uniswap/universal-router/blob/2.1.2/contracts/interfaces/IUniversalRouter.sol
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
 * Command / action ids, INTERFACE_CCA §4.7.
 * V4_SWAP: universal-router tag 2.1.2 `Commands.sol` L35.
 * Actions: v4-periphery pin 545a5d2 `Actions.sol` L28 / L40 / L44.
 */
export const V4_SWAP_COMMAND = 0x10;
export const SWAP_EXACT_IN_SINGLE = 0x06;
export const SETTLE_ALL = 0x0c;
export const TAKE_ALL = 0x0f;

/**
 * v4-periphery pin 545a5d2 `IV4Router.sol` L31-L38 — six fields.
 * `minHopPriceX36 = 0` disables the per-hop price check.
 */
export const exactInputSingleParamsAbi = {
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
    { name: "minHopPriceX36", type: "uint256" },
    { name: "hookData", type: "bytes" },
  ],
} as const;

/** SETTLE_ALL / TAKE_ALL both take `(Currency currency, uint256 amount)`. */
export const currencyAmountAbi = [
  { name: "currency", type: "address" },
  { name: "amount", type: "uint256" },
] as const;

/** v4-periphery `IV4Router.sol` L13 — the slippage revert the swap UI must map. */
export const v4RouterErrorsAbi = [
  {
    type: "error",
    name: "V4TooLittleReceived",
    inputs: [
      { name: "minAmountOutReceived", type: "uint256" },
      { name: "amountReceived", type: "uint256" },
    ],
  },
] as const;
