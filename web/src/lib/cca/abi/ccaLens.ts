/**
 * Source: Uniswap/continuous-clearing-auction
 * Tag / commit (canonical lens deployment): v2.0.0 / aee9bca51c92c24eb24a00d75ad98e678bac61d3
 * Interface also confirmed on tag v2.1.0 (same `state` surface).
 * URLs:
 *   https://github.com/Uniswap/continuous-clearing-auction/blob/v2.1.0/src/lens/CCALens.sol
 *   https://github.com/Uniswap/continuous-clearing-auction/blob/v2.1.0/src/lens/AuctionStateLens.sol
 *   https://github.com/Uniswap/continuous-clearing-auction/blob/v2.1.0/src/libraries/CheckpointLib.sol
 *   https://github.com/Uniswap/continuous-clearing-auction/blob/v2.0.0/README.md
 *
 * `state(auction)` is not `view`: the lens checkpoints via try/catch and
 * returns AuctionState. Call it with eth_call / simulateContract.
 * Only functions / errors verified in that source. No invented names.
 */
export const ccaLensAbi = [
  {
    type: "function",
    name: "state",
    stateMutability: "nonpayable",
    inputs: [{ name: "auction", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          {
            name: "checkpoint",
            type: "tuple",
            components: [
              { name: "clearingPrice", type: "uint256" },
              { name: "currencyRaisedAtClearingPriceQ96X7", type: "uint256" },
              { name: "cumulativeMpsPerPrice", type: "uint256" },
              { name: "cumulativeMps", type: "uint24" },
              { name: "prev", type: "uint64" },
              { name: "next", type: "uint64" },
            ],
          },
          { name: "currencyRaised", type: "uint256" },
          { name: "totalCleared", type: "uint256" },
          { name: "isGraduated", type: "bool" },
        ],
      },
    ],
  },
  { type: "error", name: "CheckpointFailed", inputs: [] },
  { type: "error", name: "InvalidRevertReasonLength", inputs: [] },
] as const;
