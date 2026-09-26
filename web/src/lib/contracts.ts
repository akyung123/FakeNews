import { webEnv } from "./env";
import { launchpadAbi } from "./launchpadAbi";

/**
 * On-chain addresses the UI will read later.
 * Placeholders only: a missing env value stays undefined.
 */
export const contracts = {
  launchpad: webEnv.launchpadAddress,
  universalResolver: webEnv.universalResolver,
} as const;

export { launchpadAbi };

export function hasLaunchpad(): boolean {
  return Boolean(contracts.launchpad);
}
