import { resolveCcaProductAddresses } from "./cca/addresses";
import { webEnv } from "./env";
import { launchpadAbi } from "./launchpadAbi";

const product = resolveCcaProductAddresses();

/**
 * On-chain addresses the UI will read later.
 * Placeholders only: a missing env value stays undefined.
 * Hook / locker / launchpad come from VITE_* or deployments/sepolia.json.
 * Official Uniswap pins (pool manager, LBP strategy) fill only when the
 * env key is empty — those addresses are already in INTERFACE_CCA §0.1.
 */
export const contracts = {
  launchpad: product.launchpad,
  hook: product.hook,
  locker: product.locker,
  poolManager: product.poolManager,
  lbpStrategy: product.lbpStrategy,
  positionManager: product.positionManager,
  universalResolver: webEnv.universalResolver,
} as const;

export { launchpadAbi };

export function hasLaunchpad(): boolean {
  return Boolean(contracts.launchpad);
}
