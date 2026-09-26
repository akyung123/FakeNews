/**
 * Confirmed CCA / LBP values — INTERFACE_CCA.md §0.1
 * (PR #40 head 3e128b5, source PR #41 head d84aed4, Sepolia pin 11_784_960).
 *
 * Keep every product number here so INTERFACE_CCA can override via
 * `resolveCcaConfig`. Do not scatter these values across the CCA lib.
 */
import { encodePacked, parseEther, zeroAddress, type Address, type Hex } from "viem";

export const Q96 = 0x1000000000000000000000000n;
export const WAD = 10n ** 18n;

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
  floorPriceQ96: 1000n << 96n,
  tickSpacingQ96: 100n << 96n,
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
