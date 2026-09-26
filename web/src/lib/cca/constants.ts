/**
 * Product-fixed CCA / LBP values on Sepolia.
 * Currency is native ETH (address(0)). Pool fee 1% = 10_000 hundredths of a bip.
 */
import { parseEther, zeroAddress, type Address } from "viem";

/** Q96 = 2^96. CCA stores prices as currency/token in this encoding. */
export const Q96 = 0x1000000000000000000000000n;

export const NATIVE_ETH = zeroAddress;
export const AUCTION_BLOCKS = 25;
export const GRADUATION_ETH_WEI = parseEther("0.02");
export const POOL_FEE = 10_000;
export const POOL_TICK_SPACING = 200;
export const PROPHET_FEE_SHARE = 24;
export const PROTOCOL_FEE_SHARE = 76;

/** Sepolia / Ethereum slot time used only to render (~mm:ss). Not an on-chain value. */
export const SEPOLIA_BLOCK_SECONDS = 12;

export const WAD = 10n ** 18n;

export type CcaAddress = Address;
