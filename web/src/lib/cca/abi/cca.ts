/**
 * Source: Uniswap/continuous-clearing-auction
 * Tag: v2.1.0
 * Commit (factory deployment, official docs): 7d7602d257733315434570f2a0c2f94f1c7b207a
 * URLs:
 *   https://github.com/Uniswap/continuous-clearing-auction/blob/v2.1.0/src/interfaces/IContinuousClearingAuction.sol
 *   https://github.com/Uniswap/continuous-clearing-auction/blob/v2.1.0/src/interfaces/IAuctionStorage.sol
 *   https://github.com/Uniswap/continuous-clearing-auction/blob/v2.1.0/src/interfaces/IBidStorage.sol
 *   https://github.com/Uniswap/continuous-clearing-auction/blob/v2.1.0/src/interfaces/ITickStorage.sol
 *   https://github.com/Uniswap/continuous-clearing-auction/blob/v2.1.0/src/interfaces/IStepStorage.sol
 *   https://github.com/Uniswap/continuous-clearing-auction/blob/v2.1.0/src/libraries/BidLib.sol
 *   https://github.com/Uniswap/continuous-clearing-auction/blob/v2.1.0/src/libraries/CheckpointLib.sol
 *
 * Only functions / events / errors verified in that source. No invented names.
 * Price arguments are Q96 (`maxPriceQ96`). Currency ETH is address(0).
 */
export const ccaAbi = [
  {
    type: "function",
    name: "submitBid",
    stateMutability: "payable",
    inputs: [
      { name: "maxPriceQ96", type: "uint256" },
      { name: "amount", type: "uint128" },
      { name: "owner", type: "address" },
      { name: "prevTickPriceQ96", type: "uint256" },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [{ name: "bidId", type: "uint256" }],
  },
  {
    type: "function",
    name: "submitBid",
    stateMutability: "payable",
    inputs: [
      { name: "maxPriceQ96", type: "uint256" },
      { name: "amount", type: "uint128" },
      { name: "owner", type: "address" },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [{ name: "bidId", type: "uint256" }],
  },
  {
    type: "function",
    name: "exitBid",
    stateMutability: "nonpayable",
    inputs: [{ name: "bidId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "exitPartiallyFilledBid",
    stateMutability: "nonpayable",
    inputs: [
      { name: "bidId", type: "uint256" },
      { name: "lastFullyFilledCheckpointBlock", type: "uint64" },
      { name: "outbidBlock", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimTokens",
    stateMutability: "nonpayable",
    inputs: [{ name: "bidId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claimTokensBatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner", type: "address" },
      { name: "bidIds", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "checkpoint",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [
      {
        name: "_checkpoint",
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
    ],
  },
  {
    type: "function",
    name: "clearingPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "isGraduated",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "currencyRaised",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalCleared",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "currency",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "token",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "startBlock",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint64" }],
  },
  {
    type: "function",
    name: "endBlock",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint64" }],
  },
  {
    type: "function",
    name: "claimBlock",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint64" }],
  },
  {
    type: "function",
    name: "floorPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "tickSpacing",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "nextActiveTickPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "bids",
    stateMutability: "view",
    inputs: [{ name: "bidId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "startBlock", type: "uint64" },
          { name: "startCumulativeMps", type: "uint24" },
          { name: "exitedBlock", type: "uint64" },
          { name: "maxPrice", type: "uint256" },
          { name: "owner", type: "address" },
          { name: "amountQ96", type: "uint256" },
          { name: "tokensFilled", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "nextBidId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "BidSubmitted",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "priceQ96", type: "uint256", indexed: false },
      { name: "amount", type: "uint128", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BidExited",
    inputs: [
      { name: "bidId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "tokensFilled", type: "uint256", indexed: false },
      { name: "currencyRefunded", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TokensClaimed",
    inputs: [
      { name: "bidId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "tokensFilled", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CheckpointUpdated",
    inputs: [
      { name: "blockNumber", type: "uint256", indexed: false },
      { name: "clearingPriceQ96", type: "uint256", indexed: false },
      { name: "cumulativeMps", type: "uint24", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ClearingPriceUpdated",
    inputs: [
      { name: "blockNumber", type: "uint256", indexed: false },
      { name: "clearingPriceQ96", type: "uint256", indexed: false },
    ],
  },
  { type: "error", name: "InvalidAmount", inputs: [] },
  { type: "error", name: "BidOwnerCannotBeZeroAddress", inputs: [] },
  { type: "error", name: "BidMustBeAboveClearingPrice", inputs: [] },
  {
    type: "error",
    name: "InvalidBidPriceTooHigh",
    inputs: [
      { name: "maxPriceQ96", type: "uint256" },
      { name: "maxBidPriceQ96", type: "uint256" },
    ],
  },
  { type: "error", name: "BidAmountTooSmall", inputs: [] },
  { type: "error", name: "CurrencyIsNotNative", inputs: [] },
  { type: "error", name: "AuctionNotStarted", inputs: [] },
  { type: "error", name: "AuctionIsOver", inputs: [] },
  { type: "error", name: "AuctionIsNotOver", inputs: [] },
  { type: "error", name: "AuctionIsNotFinalized", inputs: [] },
  { type: "error", name: "TokensNotReceived", inputs: [] },
  { type: "error", name: "BidAlreadyExited", inputs: [] },
  { type: "error", name: "CannotExitBid", inputs: [] },
  { type: "error", name: "CannotPartiallyExitBidBeforeEndBlock", inputs: [] },
  { type: "error", name: "CannotPartiallyExitBidBeforeGraduation", inputs: [] },
  { type: "error", name: "InvalidLastFullyFilledCheckpointHint", inputs: [] },
  { type: "error", name: "InvalidOutbidBlockCheckpointHint", inputs: [] },
  { type: "error", name: "BidNotExited", inputs: [] },
  { type: "error", name: "NotClaimable", inputs: [] },
  { type: "error", name: "NotGraduated", inputs: [] },
  { type: "error", name: "AuctionSoldOut", inputs: [] },
  { type: "error", name: "InvalidBidUnableToClear", inputs: [] },
  { type: "error", name: "TickPriceNotAtBoundary", inputs: [] },
  { type: "error", name: "TickPreviousPriceInvalid", inputs: [] },
  { type: "error", name: "TickNotInitialized", inputs: [] },
  { type: "error", name: "InvalidTickPrice", inputs: [] },
  {
    type: "error",
    name: "BidIdDoesNotExist",
    inputs: [{ name: "bidId", type: "uint256" }],
  },
] as const;
