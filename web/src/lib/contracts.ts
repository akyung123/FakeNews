import { webEnv } from "./env";

/**
 * On-chain addresses the UI will read later.
 * Placeholders only: a missing env value stays undefined.
 */
export const contracts = {
  launchpad: webEnv.launchpadAddress,
  universalResolver: webEnv.universalResolver,
} as const;

export function hasLaunchpad(): boolean {
  return Boolean(contracts.launchpad);
}
