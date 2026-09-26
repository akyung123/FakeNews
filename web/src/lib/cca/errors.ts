/**
 * Map CCA / LBP / Universal Router reverts to kinds, then to designer copy.
 * Official error names look up `CCA_ERROR_COPY` first. Kind messages are
 * fallbacks and must never leak a revert name.
 */
import {
  CCA_CLAIM_ERROR_COPY,
  CCA_SWAP_ERROR_COPY,
  ccaErrorCopy,
  officialCcaErrorName,
  type CcaErrorCopyVars,
} from "./copy";

export type CcaErrorKind =
  | "auction_not_live"
  | "bid_rejected"
  | "cannot_exit"
  | "cannot_claim"
  | "goal_not_reached"
  | "market_not_ready"
  | "launch_rejected"
  | "swap_failed"
  | "user_rejected"
  | "reverted"
  | "network";

export function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name} ${error.message}`;
  return String(error);
}

export function mapCcaError(error: unknown): CcaErrorKind {
  const text = errorText(error);
  if (/user rejected|user denied|action_rejected|user_rejected/i.test(text)) return "user_rejected";
  if (/AuctionNotStarted|AuctionIsOver|TokensNotReceived|AuctionSoldOut|CurrencyIsNotNative/i.test(text)) {
    return "auction_not_live";
  }
  if (
    /BidMustBeAboveClearingPrice|InvalidBidPriceTooHigh|BidAmountTooSmall|InvalidAmount|TickPriceNotAtBoundary|BidOwnerCannotBeZeroAddress|InvalidBidUnableToClear|TickPreviousPriceInvalid|TickPriceNotIncreasing|TickNotInitialized|InvalidTickPrice|TickHintMustBeGreaterThanNextActiveTickPrice|MaxPriceBelowFloor|below the auction floor/i.test(
      text,
    )
  ) {
    return "bid_rejected";
  }
  if (
    /CannotExitBid|BidAlreadyExited|CannotPartiallyExitBidBeforeGraduation|CannotPartiallyExitBidBeforeEndBlock|InvalidLastFullyFilledCheckpointHint|InvalidOutbidBlockCheckpointHint|AuctionIsNotOver|BidIdDoesNotExist/i.test(
      text,
    )
  ) {
    return "cannot_exit";
  }
  if (/BidNotExited|NotClaimable|AuctionIsNotFinalized|BatchClaimDifferentOwner/i.test(text)) {
    return "cannot_claim";
  }
  if (/NotGraduated/i.test(text)) return "goal_not_reached";
  if (
    /MigrationNotYetAllowed|InitializerNotRegistered|PoolManagerAlreadyUnlocked|CurrencyRaisedMismatch|NoPositionsCreated|OnlySelfCall/i.test(
      text,
    )
  ) {
    return "market_not_ready";
  }
  if (
    /ZeroAddressToken|InitializerAlreadyCreated|InvalidFundsRecipient|InvalidTokensRecipient|InvalidEndBlock|InvalidRecipient|InvalidPositionRecipient|InvalidTickSpacing|InvalidFee|InvalidHook|ClaimBlockIsBeforeEndBlock|FloorPriceIsZero|FloorPriceTooLow|TickSpacingTooSmall|TotalSupplyIsZero|TokenIsAddressZero/i.test(
      text,
    )
  ) {
    return "launch_rejected";
  }
  if (
    /ExecutionFailed|TransactionDeadlinePassed|V4TooLittleReceived|LengthMismatch|InsufficientAllowance|AllowanceExpired|PoolNotInitialized/i.test(
      text,
    )
  ) {
    return "swap_failed";
  }
  if (/did not succeed|reverted/i.test(text)) return "reverted";
  return "network";
}

/** Designer-facing lines. Never a raw selector or revert name. */
export function ccaUserMessage(kind: CcaErrorKind): string {
  switch (kind) {
    case "auction_not_live":
      return "This auction is not taking bids right now.";
    case "bid_rejected":
      return "That bid could not be placed. Check the budget and max price.";
    case "cannot_exit":
      return "Unused ETH cannot be returned yet.";
    case "cannot_claim":
      return "Tokens cannot be claimed yet.";
    case "goal_not_reached":
      return CCA_CLAIM_ERROR_COPY.NotGraduated;
    case "market_not_ready":
      return "The market cannot be opened yet.";
    case "launch_rejected":
      return "Couldn't start the auction. Try again.";
    case "swap_failed":
      return CCA_SWAP_ERROR_COPY.ExecutionFailed;
    case "user_rejected":
      return "Wallet confirmation was cancelled.";
    case "reverted":
      return "The transaction did not succeed.";
    case "network":
      return "Something went wrong. Please try again.";
  }
}

/** Prefer the official-name map; fall back to the kind sentence. */
export function ccaErrorCopyFor(error: unknown, vars: CcaErrorCopyVars = {}): string {
  const named = officialCcaErrorName(errorText(error));
  if (named) {
    const line = ccaErrorCopy(named, vars);
    if (line) return line;
  }
  return ccaUserMessage(mapCcaError(error));
}
