/**
 * Open the market: LBPStrategy.migrate(initializer).
 * Anyone can call it after the auction ends and the goal is reached.
 * The initializer is the CCA auction (ILBPInitializer).
 * Verified: ILBPStrategy.migrate at liquidity-launcher 1c5904912aefceaceb89c24528cd5e25d0b61597.
 */
import type { Address } from "viem";
import { CCA_SEPOLIA } from "./addresses";
import { lbpStrategyAbi } from "./abi/lbpStrategy";
import { sendCcaWrite, type CcaWriteOptions, type CcaWriteRequest } from "./writes";
import type { Hex } from "../world";

export function openMarketWrite(
  initializer: Address,
  strategy = CCA_SEPOLIA.lbpStrategy,
): CcaWriteRequest {
  return {
    address: strategy,
    abi: lbpStrategyAbi,
    functionName: "migrate",
    args: [initializer],
  };
}

export async function openMarket(
  initializer: Address,
  options: CcaWriteOptions = {},
  strategy = CCA_SEPOLIA.lbpStrategy,
): Promise<Hex> {
  return sendCcaWrite(openMarketWrite(initializer, strategy), "migrate", options);
}
