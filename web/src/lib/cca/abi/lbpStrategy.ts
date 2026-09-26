/**
 * Source: Uniswap/liquidity-launcher
 * Version: LBPStrategy v3.3.0
 * Commit: 1c5904912aefceaceb89c24528cd5e25d0b61597
 * URLs:
 *   https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/interfaces/ILBPStrategy.sol
 *   https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/strategies/lbp/LBPStrategy.sol
 *   https://developers.uniswap.org/docs/liquidity/liquidity-launchpad/deployments
 *
 * `migrate(initializer)` opens the market: sweeps the CCA and seeds the v4 pool.
 * The initializer for a CCA launch is the auction contract.
 * Only functions / events / errors verified in that source. No invented names.
 */
export const lbpStrategyAbi = [
  {
    type: "function",
    name: "migrate",
    stateMutability: "nonpayable",
    inputs: [{ name: "initializer", type: "address" }],
    outputs: [],
  },
  {
    type: "event",
    name: "Migrated",
    inputs: [
      { name: "initializer", type: "address", indexed: true },
      {
        name: "key",
        type: "tuple",
        indexed: true,
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      { name: "initialSqrtPriceX96", type: "uint160", indexed: false },
      { name: "plan", type: "bytes", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MigrationFailed",
    inputs: [
      { name: "initializer", type: "address", indexed: true },
      { name: "reason", type: "bytes", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FundsRecovered",
    inputs: [
      { name: "initializer", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "error",
    name: "InitializerNotRegistered",
    inputs: [{ name: "initializer", type: "address" }],
  },
  {
    type: "error",
    name: "MigrationNotYetAllowed",
    inputs: [
      { name: "migrationBlock", type: "uint256" },
      { name: "currentBlock", type: "uint256" },
    ],
  },
  { type: "error", name: "PoolManagerAlreadyUnlocked", inputs: [] },
] as const;
