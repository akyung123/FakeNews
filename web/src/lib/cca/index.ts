/**
 * Additive CCA auction library. Do not import this from existing pages
 * or components — PR 1 has no UI wiring.
 */
export { ccaAbi } from "./abi/cca";
export { ccaLensAbi } from "./abi/ccaLens";
export { lbpStrategyAbi } from "./abi/lbpStrategy";
export {
  SETTLE_ALL,
  SWAP_EXACT_IN_SINGLE,
  TAKE_ALL,
  V4_SWAP_COMMAND,
  universalRouterAbi,
} from "./abi/universalRouter";
export { CCA_SEPOLIA } from "./addresses";
export {
  AUCTION_BLOCKS,
  GRADUATION_ETH_WEI,
  NATIVE_ETH,
  POOL_FEE,
  POOL_TICK_SPACING,
  PROPHET_FEE_SHARE,
  PROTOCOL_FEE_SHARE,
  Q96,
  SEPOLIA_BLOCK_SECONDS,
  WAD,
} from "./constants";
export {
  CCA_COPY,
  auctionLiveCopy,
  blocksToMmSs,
  formatMmSs,
  graduationGoalWei,
  raisedProgressCopy,
  refundUnusedCopy,
} from "./copy";
export { ccaUserMessage, errorText, mapCcaError, type CcaErrorKind } from "./errors";
export {
  auctionScheduleRequest,
  bidRead,
  blocksRemaining,
  ccaLensStateRequest,
  deriveAuctionView,
  readAuctionLensState,
  readAuctionView,
  type AuctionPhase,
  type AuctionView,
  type CcaCheckpoint,
  type CcaLensState,
} from "./auction";
export { placeBid, placeBidArgs, placeBidWrite, type PlaceBidInput } from "./bid";
export { claimTokens, claimTokensBatch, claimTokensBatchWrite, claimTokensWrite } from "./claim";
export {
  exitBid,
  exitBidWrite,
  exitPartiallyFilledBid,
  exitPartiallyFilledBidWrite,
} from "./exit";
export { openMarket, openMarketWrite } from "./migrate";
export {
  encodeV4ExactInSingle,
  ethTokenPoolKey,
  swapExactInSingle,
  swapExactInSingleWrite,
  type ExactInSingleInput,
  type V4PoolKey,
} from "./swap";
export {
  INTERFACE_CCA_PENDING,
  INTERFACE_CCA_TBD,
  InterfaceCcaPendingError,
  auctionAddressForToken,
  claimProphetFeeCcaWrite,
  initializerAddressForToken,
  launchCcaWrite,
  poolHooksForToken,
} from "./launchpadCca";
export {
  alignPriceToTick,
  bidAmountQ96ToWei,
  budgetEthToAmount,
  ethPerTokenToQ96,
  q96ToEthPerToken,
  q96ToWeiPerToken,
  weiPerTokenToQ96,
} from "./price";
export {
  assertSuccessfulReceipt,
  sendCcaWrite,
  type CcaWriteOptions,
  type CcaWriteRequest,
} from "./writes";
