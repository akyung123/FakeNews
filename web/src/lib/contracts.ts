import { webEnv } from "./env";
import { launchpadAbi } from "./launchpadAbi";

/**
 * On-chain addresses the UI will read later.
 * Placeholders only: a missing env value stays undefined.
 * Hook / locker / launchpad come from deployments/sepolia.json via Vite.
 * Official Uniswap pins (pool manager, LBP strategy) fill only when the
 * env key is empty — those addresses are already in INTERFACE_CCA §0.1.
 */
export const contracts = {
  launchpad: webEnv.launchpadAddress,
  hook: webEnv.hookAddress,
  locker: webEnv.lockerAddress,
  poolManager: webEnv.poolManagerAddress,
  lbpStrategy: webEnv.lbpStrategy,
  positionManager: webEnv.positionManager,
  universalResolver: webEnv.universalResolver,
} as const;

export { launchpadAbi };

export function hasLaunchpad(): boolean {
  return Boolean(contracts.launchpad);
}
