/**
 * Additive CCA auction library. Do not import this from existing pages
 * or components — PR 1 has no UI wiring.
 */
export { ccaAbi } from "./abi/cca";
export { ccaLensAbi } from "./abi/ccaLens";
export { lbpStrategyAbi } from "./abi/lbpStrategy";
export { launchpadCcaAbi, lockerCcaAbi } from "./abi/launchpadCca";
export { universalRouterAbi } from "./abi/universalRouter";
export { CCA_SEPOLIA, FUNDS_RECIPIENT } from "./addresses";
export {
  AUCTION_BLOCKS,
  AUCTION_STEPS_MPS_TOTAL,
  CCA_CONFIG,
  FIRST_BID_ID,
  FLOOR_PRICE_Q96,
  GRADUATION_ETH_WEI,
  NATIVE_ETH,
  POOL_FEE,
  POOL_TICK_SPACING,
  PROPHET_FEE_SHARE,
  PROTOCOL_FEE_SHARE,
  Q96,
  SEPOLIA_BLOCK_SECONDS,
  TICK_SPACING_Q96,
  WAD,
  auctionClaimBlock,
  auctionEndBlock,
  auctionMigrationBlock,
  packUniformAuctionSteps,
  resolveCcaConfig,
  type CcaConfig,
} from "./config";
export {
  CCA_BID_ERROR_COPY,
  CCA_CLAIM_ERROR_COPY,
  CCA_COPY,
  CCA_ERROR_COPY,
  CCA_EXIT_ERROR_COPY,
  CCA_LAUNCH_ERROR_COPY,
  CCA_LAUNCH_ERROR_MESSAGE,
  CCA_LAUNCH_ERROR_NAMES,
  CCA_MIGRATE_ERROR_COPY,
  FEE_COLLECT_COPY,
  SWAP_SECTION_COPY,
  auctionLiveCopy,
  auctionStatusCopy,
  auctionStatusSubCopy,
  blocksToMmSs,
  ccaErrorCopy,
  claimBlockedCopy,
  departedReplacesAuctionStatus,
  exitCtaCopy,
  exitDoneCopy,
  exitHelpCopy,
  feeCollectCopy,
  formatMmSs,
  getEthBackCopy,
  graduationGoalWei,
  officialCcaErrorName,
  openMarketBeforeCopy,
  raisedProgressCopy,
  refundUnusedCopy,
  swapSectionCopy,
  yourBidCopy,
  type AuctionCopyStatus,
  type CcaErrorCopyVars,
  type CcaOfficialErrorName,
} from "./copy";
export { ccaErrorCopyFor, ccaUserMessage, errorText, mapCcaError, type CcaErrorKind } from "./errors";
export {
  auctionActionVisibility,
  auctionScheduleRequest,
  bidRead,
  blocksRemaining,
  canOpenMarket,
  ccaLensStateRequest,
  deriveAuctionView,
  goalNotReachedEffects,
  readAuctionLensState,
  readAuctionView,
  type AuctionActionVisibility,
  type AuctionPhase,
  type AuctionState,
  type AuctionView,
  type CcaBid,
  type CcaCheckpoint,
  type CcaLensState,
  type Checkpoint,
} from "./auction";
export { placeBid, placeBidArgs, placeBidWrite, type PlaceBidInput } from "./bid";
export { claimTokens, claimTokensBatch, claimTokensBatchWrite, claimTokensWrite } from "./claim";
export { checkpoint, checkpointWrite } from "./checkpoint";
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
  auctionOfRead,
  backendLaunchErrorNames,
  collectCcaWrite,
  hookRead,
  initializeDistributionSalt,
  initializerFromAuction,
  launchCcaWrite,
  lockerCollectActionBytes,
  lockerRead,
  lockerTokenIdBinding,
  withdrawAccruedWrite,
} from "./launchpadCca";
export {
  MaxPriceBelowFloorError,
  alignPriceToTick,
  bidAmountQ96ToWei,
  budgetEthToAmount,
  ethPerTokenToQ96,
  prevTickHintQ96,
  q96ToEthPerToken,
  q96ToWeiPerToken,
  snapMaxPriceToTick,
  weiPerTokenToQ96,
} from "./price";
export {
  assertSuccessfulReceipt,
  sendCcaWrite,
  type CcaWriteOptions,
  type CcaWriteRequest,
} from "./writes";
export {
  bidExitedLogsQuery,
  bidSubmittedLogsQuery,
  ccaEventLogsQuery,
  ccaLogsFromBlock,
  fetchCcaEventLogs,
  tokensClaimedLogsQuery,
  type CcaAuctionEvent,
} from "./logs";
export { CCA_FORK_PIN_BLOCK, CCA_FORK_STEPS, forkHappyPathSchedule } from "./flow";
