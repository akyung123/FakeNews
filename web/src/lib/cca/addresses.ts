/**
 * Fixed Sepolia addresses — INTERFACE_CCA.md §0.1
 * (PR #40 head b02a445, verified on PR #41 fork block 11_784_960).
 *
 * LBPStrategy v3.3.0, CCA factory v2.1.0, InitializerHook v3.3.0:
 *   https://developers.uniswap.org/docs/liquidity/liquidity-launchpad/deployments
 * CCALens v2.0.0:
 *   https://github.com/Uniswap/continuous-clearing-auction/blob/v2.0.0/README.md
 * Universal Router 2.1.2 + v4 periphery:
 *   https://docs.uniswap.org/contracts/v4/deployments
 */
import type { Address } from "viem";

export const CCA_SEPOLIA = {
  lbpStrategy: "0x95434E898Af471945Cab33D5064d2aC1A6Ba2000" as Address,
  ccaFactory: "0x000000001F26a0044BaA66024e7b6599c61963F8" as Address,
  initializerHook: "0x1600059B95A80d500fC42400ea9a88A9C29D2000" as Address,
  ccaLens: "0xc3C65F5453A3674aDb693cbdA3C842545cD30f53" as Address,
  /** INTERFACE_CCA §0.1 — Universal Router 2.1.2. Command bytes stay TBD. */
  universalRouter: "0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3" as Address,
  poolManager: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543" as Address,
  positionManager: "0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4" as Address,
  stateView: "0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c" as Address,
  quoter: "0x61b3f2011a92d183c7dbadbda940a7555ccf9227" as Address,
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address,
} as const;

/** `AuctionParameters.fundsRecipient` must be LBPStrategy. */
export const FUNDS_RECIPIENT = CCA_SEPOLIA.lbpStrategy;
