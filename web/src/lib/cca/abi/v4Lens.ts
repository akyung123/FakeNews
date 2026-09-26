/**
 * Read-only v4 periphery used by the swap box and the live chart.
 * Sepolia addresses are pinned in INTERFACE_CCA §0.1:
 *   StateView `0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c`
 *   Quoter    `0x61b3f2011a92d183c7dbadbda940a7555ccf9227`
 */

/** `getSlot0(poolId)` is the pool's current price. Zero sqrtPriceX96 = not initialized. */
export const stateViewAbi = [
  {
    type: "function",
    name: "getSlot0",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "protocolFee", type: "uint24" },
      { name: "lpFee", type: "uint24" },
    ],
  },
  {
    type: "function",
    name: "getLiquidity",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ name: "liquidity", type: "uint128" }],
  },
] as const;

/**
 * `quoteExactInputSingle` is not `view` — it swaps and reverts internally, so
 * it has to go through `simulateContract`, like CCALens `state`.
 */
export const quoterAbi = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
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
          { name: "exactAmount", type: "uint128" },
          { name: "hookData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
  { type: "error", name: "PoolNotInitialized", inputs: [] },
] as const;
