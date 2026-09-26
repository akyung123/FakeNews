/**
 * Confirmed CCA / LBP values from the backend fork test
 * (PR #41 head d84aed4, Sepolia pin block 11_784_960).
 *
 * Keep every product number here so `docs/INTERFACE_CCA.md` can override
 * this object later. Do not scatter these values across the CCA lib.
 */
import { parseEther, zeroAddress, type Address } from "viem";

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
