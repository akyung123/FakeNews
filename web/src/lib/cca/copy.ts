/**
 * Designer FINAL auction copy (aligned to INTERFACE_CCA.md PR #40 @ b02a445 §7).
 * English only. No wording about profit, yield, or price outlooks.
 * `{n}`, `{blocks}`, `{raised}`, `{amount}`, `{budget}`, `{max}`,
 * `{claimBlock}`, `{migrationBlock}` are interpolated by the helpers below.
 */
import { formatEther } from "viem";
import { GRADUATION_ETH_WEI, SEPOLIA_BLOCK_SECONDS } from "./config";
import { INTERFACE_CCA_TBD, InterfaceCcaPendingError } from "./launchpadCca";

export type AuctionCopyStatus =
  | "not_funded"
  | "not_started"
  | "live"
  | "sold_out"
  | "ended_not_finalized"
  | "graduated"
  | "failed"
  | "pool_open";

export type CcaErrorCopyVars = {
  claimBlock?: bigint | number | string;
  migrationBlock?: bigint | number | string;
};

export const CCA_COPY = {
  notFunded: "Auction is getting ready",
  notStarted: "Auction starts in {startBlock - block} blocks",
  auctionLive: "Auction live · ends in {blocks} blocks",
  soldOut: "Auction live · all tokens are bid for",
  soldOutSub: "New bids are closed. Come back when the auction ends.",
  endedNotFinalized: "Auction ended · final price not set yet",
  setFinalPrice: "Set final price",
  settingFinalPrice: "Setting final price…",
  graduated: "Auction ended · ready to open the market",
  goalNotReached: "Auction ended · goal not reached",
  goalNotReachedSub:
    "The goal wasn't reached, so no tokens were issued and the market won't open. Every bid is returned in full.",
  poolOpen: "Market open on Uniswap v4",

  currentClearingPrice: "Current clearing price",
  finalClearingPrice: "Final clearing price",
  clearingPriceHelp:
    "Everyone buying in the same block pays that block's price per token. You never pay more than your max price.",

  raisedProgress: "{raised} of 0.02 ETH raised to open the market",

  budgetEth: "Budget (ETH)",
  maxPricePerToken: "Max price per token (ETH)",
  bidHelp:
    "You never pay more than your max price. After the auction ends, you can get back any ETH not used.",
  placeBid: "Place bid",
  placingBid: "Placing bid…",
  bidPlaced: "Bid placed",
  yourBid: "Your bid · {budget} ETH up to {max} ETH per token",

  refundUnused: "Get back unused ETH ({amount} ETH)",
  getEthBack: "Get your ETH back ({amount} ETH)",
  ethReturned: "ETH returned",
  sendingEth: "Sending ETH…",
  exitHelp: "Do this first, even if all of your budget was used. Then claim your tokens.",
  allBudgetUsed: "All of your budget was used.",

  claimTokens: "Claim tokens",
  claiming: "Claiming…",
  tokensClaimed: "Tokens claimed",
  claimBlocked: "Tokens can be claimed from block {claimBlock}.",

  openMarket: "Open market",
  openMarketHelp:
    "Moves the raised ETH and tokens into a Uniswap v4 pool. Anyone can do this once the auction ends and the goal is reached.",
  openMarketBefore: "The market can open from block {migrationBlock}.",
  openingMarket: "Opening market…",
  marketOpen: "Market open. You can swap now.",
} as const;

/** §7.10. `{SYMBOL}`, `{amount}`, `{minAmount}`, `{n}`, `{total}` are interpolated below. */
export const SWAP_SECTION_COPY = {
  title: "Swap",
  beforePoolOpen: "Swapping opens when the market opens.",
  buyTab: "Buy",
  sellTab: "Sell",
  feeNote: "Pool fee 1%. Fees are split 24% to the prophet and 76% to the protocol.",

  buyField: "You pay (ETH)",
  buyOutput: "You get about {amount} {SYMBOL}",
  buyMinimum: "At least {minAmount} {SYMBOL}",
  buyCta: "Buy {SYMBOL}",
  buying: "Buying…",
  bought: "Bought {amount} {SYMBOL}",
  notEnoughEth: "Not enough ETH.",

  sellField: "You sell ({SYMBOL})",
  sellOutput: "You get about {amount} ETH",
  sellMinimum: "At least {minAmount} ETH",
  allowCta: "Allow Uniswap to use your {SYMBOL}",
  allowing: "Allowing…",
  allowed: "{SYMBOL} allowed",
  allowHelp: "One-time step before your first sale of this token.",
  confirmCta: "Confirm {SYMBOL} for this sale",
  confirming: "Confirming…",
  readyToSell: "Ready to sell",
  confirmHelp:
    "Lets the Uniswap router move the {SYMBOL} you sell. You may need this again later.",
  stepCounter: "Step {n} of {total}",
  sellCta: "Sell {SYMBOL}",
  selling: "Selling…",
  sold: "Sold {amount} {SYMBOL}",
  notEnoughToken: "Not enough {SYMBOL}.",
} as const;

/** §7.10 error table. Permit2 rows interpolate `{SYMBOL}`. */
export const CCA_SWAP_ERROR_COPY = {
  V4TooLittleReceived: "The price moved before your swap went through. Try again.",
  TransactionDeadlinePassed: "This swap took too long. Try again.",
  ExecutionFailed: "The swap didn't go through. Try again.",
  LengthMismatch: "The swap didn't go through. Try again.",
  InsufficientAllowance: "Confirm {SYMBOL} for this sale again, then sell.",
  AllowanceExpired: "Confirm {SYMBOL} for this sale again, then sell.",
  PoolNotInitialized: "Swapping opens when the market opens.",
} as const;

/** Wallet rejection during a swap. No revert, so it is not in the table above. */
export const SWAP_CANCELED_COPY = "Swap canceled.";

export const FEE_COLLECT_COPY = INTERFACE_CCA_TBD;

export const CCA_BID_ERROR_COPY = {
  AuctionNotStarted: "The auction hasn't started yet.",
  TokensNotReceived: "The auction isn't ready yet. Try again in a moment.",
  AuctionIsOver: "This auction has ended.",
  AuctionSoldOut: "All tokens are bid for. New bids are closed.",
  BidMustBeAboveClearingPrice: "Your max price must be above the current clearing price.",
  InvalidBidPriceTooHigh: "That max price is too high. Enter a lower one.",
  InvalidBidUnableToClear: "This bid can't be filled at that price. Raise your max price.",
  BidAmountTooSmall: "Your budget is too small. Enter a larger amount.",
  InvalidAmount: "The ETH sent doesn't match your budget. Try again.",
  CurrencyIsNotNative: "Something went wrong with this bid. Try again.",
  BidOwnerCannotBeZeroAddress: "Something went wrong with this bid. Try again.",
  TickPreviousPriceInvalid: "Prices moved. Refresh and try again.",
  TickPriceNotIncreasing: "Prices moved. Refresh and try again.",
  TickPriceNotAtBoundary: "Prices moved. Refresh and try again.",
  TickNotInitialized: "Prices moved. Refresh and try again.",
  InvalidTickPrice: "Prices moved. Refresh and try again.",
  TickHintMustBeGreaterThanNextActiveTickPrice: "Prices moved. Refresh and try again.",
} as const;

export const CCA_EXIT_ERROR_COPY = {
  AuctionIsNotOver: "You can get your ETH back after the auction ends.",
  BidAlreadyExited: "You already got your ETH back for this bid.",
  CannotExitBid: "This bid can't be settled this way. Refresh and try again.",
  CannotPartiallyExitBidBeforeGraduation: "This bid can be settled after the auction ends.",
  CannotPartiallyExitBidBeforeEndBlock: "This bid can be settled after the auction ends.",
  InvalidLastFullyFilledCheckpointHint: "Auction data changed. Refresh and try again.",
  InvalidOutbidBlockCheckpointHint: "Auction data changed. Refresh and try again.",
  BidIdDoesNotExist: "We couldn't find this bid.",
} as const;

export const CCA_CLAIM_ERROR_COPY = {
  NotGraduated: "The goal wasn't reached, so there are no tokens to claim.",
  NotClaimable: "Tokens can't be claimed yet. Try again from block {claimBlock}.",
  AuctionIsNotFinalized: "The final price isn't set yet. Set it first, then claim.",
  BidNotExited: "Get back unused ETH first, then claim your tokens.",
  BatchClaimDifferentOwner: "These bids belong to different wallets. Claim them one by one.",
} as const;

export const CCA_MIGRATE_ERROR_COPY = {
  MigrationFailed: "The market couldn't open. No pool was created.",
  MigrationNotYetAllowed: "Too early. The market can open from block {migrationBlock}.",
  InitializerNotRegistered: "This auction isn't linked to a market.",
  PoolManagerAlreadyUnlocked: "The market couldn't open. Try again.",
  CurrencyRaisedMismatch: "The market couldn't open. Try again.",
  NoPositionsCreated: "The market couldn't open. Try again.",
  OnlySelfCall: "The market couldn't open. Try again.",
} as const;

export const CCA_LAUNCH_ERROR_MESSAGE = "Couldn't start the auction. Try again.";

/** Official factory / CCA constructor names. New Launchpad names stay TBD. */
export const CCA_LAUNCH_ERROR_NAMES = [
  "ZeroAddressToken",
  "InitializerAlreadyCreated",
  "HookIsStrategy",
  "InvalidReservedTokenAmountForLP",
  "TokenMismatch",
  "CurrencyMismatch",
  "TokenAmountMismatch",
  "PoolIdOccupied",
  "InvalidFundsRecipient",
  "InvalidTokensRecipient",
  "InvalidEndBlock",
  "InvalidRecipient",
  "InvalidPositionRecipient",
  "InvalidTickSpacing",
  "InvalidFee",
  "InvalidHook",
  "InvalidTokenAmount",
  "InvalidTokenAmountReceived",
  "InvalidAmountReceived",
  "InvalidAuctionDataLength",
  "StepBlockDeltaCannotBeZero",
  "InvalidStepDataMps",
  "InvalidEndBlockGivenStepData",
  "ClaimBlockIsBeforeEndBlock",
  "FloorPriceIsZero",
  "FloorPriceTooLow",
  "TickSpacingTooSmall",
  "FloorPriceAndTickSpacingGreaterThanMaxBidPrice",
  "FloorPriceAndTickSpacingTooLarge",
  "TotalSupplyIsZero",
  "TotalSupplyIsTooLarge",
  "TokenIsAddressZero",
  "TokenAndCurrencyCannotBeTheSame",
  "FundsRecipientIsZero",
  "TokensRecipientIsZero",
] as const;

export const CCA_LAUNCH_ERROR_COPY = Object.fromEntries(
  CCA_LAUNCH_ERROR_NAMES.map((name) => [name, CCA_LAUNCH_ERROR_MESSAGE]),
) as Record<(typeof CCA_LAUNCH_ERROR_NAMES)[number], typeof CCA_LAUNCH_ERROR_MESSAGE>;

export const CCA_ERROR_COPY = {
  ...CCA_BID_ERROR_COPY,
  ...CCA_EXIT_ERROR_COPY,
  ...CCA_CLAIM_ERROR_COPY,
  ...CCA_MIGRATE_ERROR_COPY,
  ...CCA_LAUNCH_ERROR_COPY,
} as const;

export type CcaOfficialErrorName = keyof typeof CCA_ERROR_COPY;

function fill(template: string, vars: Record<string, string | number | bigint>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{${key}}`, String(value));
  }
  return out;
}

export function officialCcaErrorName(text: string): CcaOfficialErrorName | undefined {
  const names = Object.keys(CCA_ERROR_COPY) as CcaOfficialErrorName[];
  const hits = names.filter((name) => text.includes(name));
  if (hits.length === 0) return undefined;
  return hits.sort((a, b) => b.length - a.length)[0];
}

export function ccaErrorCopy(name: string, vars: CcaErrorCopyVars = {}): string | undefined {
  if (!(name in CCA_ERROR_COPY)) return undefined;
  return fill(CCA_ERROR_COPY[name as CcaOfficialErrorName], {
    claimBlock: vars.claimBlock ?? "{claimBlock}",
    migrationBlock: vars.migrationBlock ?? "{migrationBlock}",
  });
}

export function formatMmSs(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function blocksToMmSs(blocks: number, secondsPerBlock = SEPOLIA_BLOCK_SECONDS): string {
  return formatMmSs(Math.max(0, blocks) * secondsPerBlock);
}

export function auctionStatusCopy(
  status: AuctionCopyStatus,
  vars: { n?: number; blocks?: number } = {},
): string {
  switch (status) {
    case "not_funded":
      return CCA_COPY.notFunded;
    case "not_started":
      return fill(CCA_COPY.notStarted, { "startBlock - block": Math.max(0, vars.n ?? 0) });
    case "live":
      return fill(CCA_COPY.auctionLive, { blocks: Math.max(0, vars.blocks ?? 0) });
    case "sold_out":
      return CCA_COPY.soldOut;
    case "ended_not_finalized":
      return CCA_COPY.endedNotFinalized;
    case "graduated":
      return CCA_COPY.graduated;
    case "failed":
      return CCA_COPY.goalNotReached;
    case "pool_open":
      return CCA_COPY.poolOpen;
  }
}

export function auctionStatusSubCopy(status: AuctionCopyStatus): string | undefined {
  if (status === "sold_out") return CCA_COPY.soldOutSub;
  if (status === "failed") return CCA_COPY.goalNotReachedSub;
  return undefined;
}

export function auctionLiveCopy(blocks: number): string {
  return auctionStatusCopy("live", { blocks });
}

export function raisedProgressCopy(raisedWei: bigint): string {
  return fill(CCA_COPY.raisedProgress, { raised: formatEther(raisedWei) });
}

export function refundUnusedCopy(amountWei: bigint): string {
  return fill(CCA_COPY.refundUnused, { amount: formatEther(amountWei) });
}

export function getEthBackCopy(amountWei: bigint): string {
  return fill(CCA_COPY.getEthBack, { amount: formatEther(amountWei) });
}

/** Goal-met leftover CTA vs goal-not-met full refund CTA. Same label for exitBid and exitPartiallyFilledBid. */
export function exitCtaCopy(goalReached: boolean, amountWei: bigint): string {
  return goalReached ? refundUnusedCopy(amountWei) : getEthBackCopy(amountWei);
}

/** §7.4 and §7.5 both use this done line after exitBid. */
export function exitDoneCopy(_goalReached?: boolean): string {
  return CCA_COPY.ethReturned;
}

export function exitHelpCopy(goalReached: boolean, amountWei: bigint): string {
  if (!goalReached) return CCA_COPY.goalNotReachedSub;
  if (amountWei === 0n) return CCA_COPY.allBudgetUsed;
  return CCA_COPY.exitHelp;
}

export function yourBidCopy(budgetEth: string, maxPriceEth: string): string {
  return fill(CCA_COPY.yourBid, { budget: budgetEth, max: maxPriceEth });
}

export function claimBlockedCopy(claimBlock: bigint | number | string): string {
  return fill(CCA_COPY.claimBlocked, { claimBlock: String(claimBlock) });
}

export function openMarketBeforeCopy(migrationBlock: bigint | number | string): string {
  return fill(CCA_COPY.openMarketBefore, { migrationBlock: String(migrationBlock) });
}

export function graduationGoalWei(): bigint {
  return GRADUATION_ETH_WEI;
}

/** Departed is a separate badge. It never replaces an auction status string. */
export function departedReplacesAuctionStatus(): false {
  return false;
}

export type SwapCopyVars = {
  symbol?: string;
  amount?: string;
  minAmount?: string;
  n?: number;
  total?: number;
};

/** §7.10 copy with `{SYMBOL}` and the amount placeholders filled in. */
export function swapSectionCopy(vars: SwapCopyVars = {}): Record<
  keyof typeof SWAP_SECTION_COPY,
  string
> {
  const filled = {} as Record<keyof typeof SWAP_SECTION_COPY, string>;
  for (const [key, template] of Object.entries(SWAP_SECTION_COPY)) {
    filled[key as keyof typeof SWAP_SECTION_COPY] = fill(template, {
      SYMBOL: vars.symbol ?? "{SYMBOL}",
      amount: vars.amount ?? "{amount}",
      minAmount: vars.minAmount ?? "{minAmount}",
      n: vars.n ?? "{n}",
      total: vars.total ?? "{total}",
    });
  }
  return filled;
}

/** §7.10 error row for a swap revert name, or undefined when it is not a swap error. */
export function swapErrorCopy(name: string, symbol = "{SYMBOL}"): string | undefined {
  if (!(name in CCA_SWAP_ERROR_COPY)) return undefined;
  return fill(CCA_SWAP_ERROR_COPY[name as keyof typeof CCA_SWAP_ERROR_COPY], { SYMBOL: symbol });
}

export function feeCollectCopy(): never {
  throw new InterfaceCcaPendingError("fee collect copy");
}
