/**
 * Launchpad / LiquidityLocker names from INTERFACE_CCA.md PR #44
 * and PR #42 (`Launchpad.sol`, `LiquidityLocker.sol`; follow latest head).
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
    outputs: [{ name: "token", type: "address" }],
  },
  {
    type: "function",
    name: "auctionOf",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "auction", type: "address" }],
  },
  {
    type: "function",
    name: "isGraduated",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
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
    inputs: [
      { name: "token", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
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
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "tokenIdsOf",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "isRegistered",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "prophetOf",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "accruedEth",
    stateMutability: "view",
    inputs: [{ name: "prophet", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "Collected",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "prophetAmount0", type: "uint256", indexed: false },
      { name: "protocolAmount0", type: "uint256", indexed: false },
      { name: "prophetAmount1", type: "uint256", indexed: false },
      { name: "protocolAmount1", type: "uint256", indexed: false },
    ],
  },
  { type: "error", name: "UnknownLock", inputs: [] },
  { type: "error", name: "NotNftOwner", inputs: [] },
  { type: "error", name: "AlreadyReceived", inputs: [] },
  { type: "error", name: "BadPoolKey", inputs: [] },
  { type: "error", name: "NothingAccrued", inputs: [] },
  { type: "error", name: "EthTransferFailed", inputs: [] },
  { type: "error", name: "TokenTransferFailed", inputs: [] },
  { type: "error", name: "PositionManagerNotSet", inputs: [] },
  { type: "error", name: "Reentrant", inputs: [] },
] as const;

export const positionManagerAbi = [
  {
    type: "function",
    name: "nextTokenId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getPoolAndPositionInfo",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
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
      { name: "info", type: "uint256" },
    ],
  },
] as const;

export const poolManagerAbi = [
  {
    type: "function",
    name: "getSlot0",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "protocolFee", type: "uint24" },
      { name: "lpFee", type: "uint24" },
    ],
  },
] as const;
