/**
 * Map CCA / LBP / Universal Router reverts to kinds.
 * Same idea as `worldErrorKindFromRegisterProphet` in `web/src/lib/issue.ts`:
 * match verified error names, never put a raw revert code in designer copy.
 */
export type CcaErrorKind =
  | "auction_not_live"
  | "bid_rejected"
  | "cannot_exit"
  | "cannot_claim"
  | "goal_not_reached"
  | "market_not_ready"
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
  if (/AuctionNotStarted|AuctionIsOver|TokensNotReceived|AuctionSoldOut/i.test(text)) {
    return "auction_not_live";
  }
  if (
    /BidMustBeAboveClearingPrice|InvalidBidPriceTooHigh|BidAmountTooSmall|InvalidAmount|TickPriceNotAtBoundary|BidOwnerCannotBeZeroAddress|InvalidBidUnableToClear|MaxPriceBelowFloor|below the auction floor/i.test(
      text,
    )
  ) {
    return "bid_rejected";
  }
  if (
    /CannotExitBid|BidAlreadyExited|CannotPartiallyExitBid|InvalidLastFullyFilledCheckpointHint|InvalidOutbidBlockCheckpointHint|AuctionIsNotOver/i.test(
      text,
    )
  ) {
    return "cannot_exit";
  }
  if (/BidNotExited|NotClaimable|AuctionIsNotFinalized/i.test(text)) return "cannot_claim";
  if (/NotGraduated/i.test(text)) return "goal_not_reached";
  if (/MigrationNotYetAllowed|InitializerNotRegistered|PoolManagerAlreadyUnlocked/i.test(text)) {
    return "market_not_ready";
  }
  if (/ExecutionFailed|TransactionDeadlinePassed|V4TooLittleReceived|LengthMismatch/i.test(text)) {
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
      return "The goal wasn't reached, so there are no tokens to claim.";
    case "market_not_ready":
      return "The market cannot be opened yet.";
    case "swap_failed":
      return "The pool swap did not go through.";
    case "user_rejected":
      return "Wallet confirmation was cancelled.";
    case "reverted":
      return "The transaction did not succeed.";
    case "network":
      return "Something went wrong. Please try again.";
  }
}
