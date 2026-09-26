import { resolveCcaProductAddresses, type CcaProductAddresses } from "./cca/addresses";
import { hasLaunchpad } from "./contracts";

/**
 * Demo mode is ONLY when the required CCA product address is missing.
 * Required: Launchpad (`VITE_LAUNCHPAD_ADDRESS` / `deployments/sepolia.json`).
 * Official Uniswap pins do not count as "our" deploy.
 */
export const REQUIRED_CCA_ADDRESS_KEYS = ["launchpad"] as const;

export function requiredCcaAddressesReady(
  addresses: Pick<CcaProductAddresses, "launchpad"> = resolveCcaProductAddresses(),
): boolean {
  return Boolean(addresses.launchpad);
}

export function isCcaDemoMode(
  addresses: Pick<CcaProductAddresses, "launchpad"> = resolveCcaProductAddresses(),
): boolean {
  return !requiredCcaAddressesReady(addresses);
}

/**
 * Mock mode vs chain mode.
 *
 * Demo (no launchpad address): seed list, demo cash, Sample data badge.
 * Chain (launchpad set): injected wallet on Sepolia; no SAMPLE DATA in CCA.
 */
export function isMockMode(): boolean {
  return isCcaDemoMode();
}

export { hasLaunchpad };
