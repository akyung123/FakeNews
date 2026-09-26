/**
 * Fixed Sepolia addresses for the CCA + LBPStrategy line.
 *
 * LBPStrategy v3.3.0, CCA factory v2.1.0, InitializerHook v3.3.0:
 *   https://developers.uniswap.org/docs/liquidity/liquidity-launchpad/deployments
 * CCALens v2.0.0:
 *   https://github.com/Uniswap/continuous-clearing-auction/blob/v2.0.0/README.md
 * Universal Router 2.0 + Permit2:
 *   https://developers.uniswap.org/docs/protocols/v4/deployments
 */
import type { Address } from "viem";

export const CCA_SEPOLIA = {
  lbpStrategy: "0x95434E898Af471945Cab33D5064d2aC1A6Ba2000" as Address,
  ccaFactory: "0x000000001F26a0044BaA66024e7b6599c61963F8" as Address,
  initializerHook: "0x1600059B95A80d500fC42400ea9a88A9C29D2000" as Address,
  ccaLens: "0xc3C65F5453A3674aDb693cbdA3C842545cD30f53" as Address,
  universalRouter: "0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b" as Address,
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address,
} as const;
