/**
 * Launchpad / LiquidityLocker names copied from INTERFACE_CCA.md
 * (PR #40 head 3e128b5), section 2. Only names already specified there.
 *
 * Do not add guessed custom-error names (`LbpNotSet` and the like) —
 * those stay TBD(INTERFACE_CCA).
 */
export const launchpadCcaAbi = [
  {
    type: "function",
    name: "registerProphet",
    stateMutability: "nonpayable",
    inputs: [
      { name: "label", type: "string" },
      { name: "nullifier", type: "uint256" },
      { name: "serverSig", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "launch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "slug", type: "string" },
      { name: "prophecy", type: "string" },
      { name: "deadline", type: "uint64" },
    ],
    outputs: [
      { name: "token", type: "address" },
      { name: "auction", type: "address" },
    ],
  },
  {
    type: "function",
    name: "auctionOf",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "auction", type: "address" },
      { name: "poolOpened", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "prophetOf",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ name: "label", type: "string" }],
  },
  {
    type: "function",
    name: "hook",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "locker",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "lbpStrategy",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "positionManager",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "event",
    name: "Launched",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "prophet", type: "address", indexed: true },
      { name: "auction", type: "address", indexed: true },
      { name: "prophetLabel", type: "string", indexed: false },
      { name: "slug", type: "string", indexed: false },
    ],
  },
] as const;

export const lockerCcaAbi = [
  {
    type: "function",
    name: "collect",
    stateMutability: "nonpayable",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawAccrued",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "tokenIdOf",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "prophetOf",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;
