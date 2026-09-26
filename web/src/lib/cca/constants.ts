/**
 * Re-exports of `CCA_CONFIG`. Prefer importing from `./config` for new code.
 * INTERFACE_CCA overrides belong on `resolveCcaConfig`, not here.
 */
export {
  AUCTION_BLOCKS,
  AUCTION_STEPS_MPS_TOTAL,
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
  packUniformAuctionSteps,
} from "./config";
export type { Address as CcaAddress } from "viem";
