/**
 * Confirmed CCA / LBP values — INTERFACE_CCA.md §0.1
 * (PR #40 head b02a445, source PR #41 head d84aed4, Sepolia pin 11_784_960).
 *
 * Keep every product number here so INTERFACE_CCA can override via
 * `resolveCcaConfig`. Do not scatter these values across the CCA lib.
 */
import { encodePacked, parseEther, zeroAddress, type Address, type Hex } from "viem";

export const Q96 = 0x1000000000000000000000000n;
export const WAD = 10n ** 18n;

/** CcaLib 50/50 split. Live auction length is `launchpad.auctionBlocks()`, not a constant. */
export const CCA_TOTAL_SUPPLY = 1_000_000_000n * WAD;
export const CCA_AUCTION_SUPPLY = 500_000_000n * WAD;
export const CCA_LP_SUPPLY = 500_000_000n * WAD;

export type CcaConfig = {
  currency: Address;
  floorPriceQ96: bigint;
  tickSpacingQ96: bigint;
  graduationWei: bigint;
  poolFee: number;
  poolTickSpacing: number;
  auctionBlocks: number;
  firstBidId: bigint;
  prophetFeeShare: number;
  protocolFeeShare: number;
  sepoliaBlockSeconds: number;
  sepoliaForkBlock: bigint;
  /** `1e7` millibips. `packUniformAuctionSteps` requires `1e7 % N === 0`. */
  auctionStepsMpsTotal: number;
};

/** Default config. INTERFACE_CCA may replace fields via `resolveCcaConfig`. */
export const CCA_CONFIG: CcaConfig = {
  currency: zeroAddress,
  floorPriceQ96: 3_169_126_500_570_573_600n,
  tickSpacingQ96: 31_691_265_005_705_736n,
  graduationWei: parseEther("0.02"),
  poolFee: 10_000,
  poolTickSpacing: 200,
  auctionBlocks: 25,
  firstBidId: 0n,
  prophetFeeShare: 24,
  protocolFeeShare: 76,
  sepoliaBlockSeconds: 12,
  sepoliaForkBlock: 11_784_960n,
  auctionStepsMpsTotal: 10_000_000,
};

export function resolveCcaConfig(overrides: Partial<CcaConfig> = {}): CcaConfig {
  return { ...CCA_CONFIG, ...overrides };
}

/** end = start + N */
export function auctionEndBlock(startBlock: bigint, n = CCA_CONFIG.auctionBlocks): bigint {
  return startBlock + BigInt(n);
}

/** claim block = end */
export function auctionClaimBlock(startBlock: bigint, n = CCA_CONFIG.auctionBlocks): bigint {
  return auctionEndBlock(startBlock, n);
}

/** migration block = end + 1 */
export function auctionMigrationBlock(startBlock: bigint, n = CCA_CONFIG.auctionBlocks): bigint {
  return auctionEndBlock(startBlock, n) + 1n;
}

export const NATIVE_ETH = CCA_CONFIG.currency;
/** CcaLib default only. Live UI reads `launchpad.auctionBlocks()`. */
export const AUCTION_BLOCKS = CCA_CONFIG.auctionBlocks;
export const GRADUATION_ETH_WEI = CCA_CONFIG.graduationWei;
export const POOL_FEE = CCA_CONFIG.poolFee;
export const POOL_TICK_SPACING = CCA_CONFIG.poolTickSpacing;
export const PROPHET_FEE_SHARE = CCA_CONFIG.prophetFeeShare;
export const PROTOCOL_FEE_SHARE = CCA_CONFIG.protocolFeeShare;
export const SEPOLIA_BLOCK_SECONDS = CCA_CONFIG.sepoliaBlockSeconds;
export const FIRST_BID_ID = CCA_CONFIG.firstBidId;
export const FLOOR_PRICE_Q96 = CCA_CONFIG.floorPriceQ96;
export const TICK_SPACING_Q96 = CCA_CONFIG.tickSpacingQ96;
export const AUCTION_STEPS_MPS_TOTAL = CCA_CONFIG.auctionStepsMpsTotal;

/** One flag per later feature. Default on. `0` / `false` hides the section. */
export type CcaFeatureFlags = {
  migrate: boolean;
  swap: boolean;
  collect: boolean;
};

export function envFlagOn(value: string | undefined, fallback = true): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  return value !== "0" && value !== "false";
}

export function ccaFeatureFlags(
  env: {
    VITE_CCA_MIGRATE?: string;
    VITE_CCA_SWAP?: string;
    VITE_CCA_COLLECT?: string;
  } = import.meta.env,
): CcaFeatureFlags {
  return {
    migrate: envFlagOn(env.VITE_CCA_MIGRATE),
    swap: envFlagOn(env.VITE_CCA_SWAP),
    collect: envFlagOn(env.VITE_CCA_COLLECT),
  };
}

/**
 * `AuctionParameters.auctionStepsData` = `abi.encodePacked(uint24(1e7/N), uint40(N))`.
 * N=25 → (400_000, 25); N=10 → (1_000_000, 10).
 */
export function packUniformAuctionSteps(n = CCA_CONFIG.auctionBlocks): Hex {
  if (n <= 0 || AUCTION_STEPS_MPS_TOTAL % n !== 0) {
    throw new Error("auction steps require 1e7 / N to be an integer");
  }
  return encodePacked(["uint24", "uint40"], [AUCTION_STEPS_MPS_TOTAL / n, n]);
}
