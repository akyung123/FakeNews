import { hasLaunchpad } from "./contracts";

/**
 * Mock mode vs chain mode.
 *
 * Mock (no launchpad address): seed list, demo cash, Sample data badge.
 * Chain (launchpad set): reads go through the existing wagmi setup.
 * Hide anything with no real data source.
 */
export function isMockMode(): boolean {
  return !hasLaunchpad();
}
