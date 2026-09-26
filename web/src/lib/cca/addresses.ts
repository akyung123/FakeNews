/**
 * Fixed Sepolia addresses — INTERFACE_CCA.md §0.1
 * Official Uniswap / CCA pins. Product addresses (launchpad, hook, locker)
 * come from env copied out of `deployments/sepolia.json` and stay unset
 * until that file / Vite var exists. Do not invent them.
 */
import { isAddress, type Address } from "viem";
import { webEnv } from "../env";

function optionalAddress(value: string | undefined): Address | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !isAddress(trimmed)) return undefined;
  return trimmed;
}

export const CCA_SEPOLIA = {
  lbpStrategy: "0x95434E898Af471945Cab33D5064d2aC1A6Ba2000" as Address,
  ccaFactory: "0x000000001F26a0044BaA66024e7b6599c61963F8" as Address,
  initializerHook: "0x1600059B95A80d500fC42400ea9a88A9C29D2000" as Address,
  ccaLens: "0xc3C65F5453A3674aDb693cbdA3C842545cD30f53" as Address,
  /** INTERFACE_CCA §0.1 — Universal Router 2.1.2. */
  universalRouter: "0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3" as Address,
  poolManager: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543" as Address,
  positionManager: "0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4" as Address,
  stateView: "0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c" as Address,
  quoter: "0x61b3f2011a92d183c7dbadbda940a7555ccf9227" as Address,
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address,
} as const;

/** `AuctionParameters.fundsRecipient` must be LBPStrategy. */
export const FUNDS_RECIPIENT = CCA_SEPOLIA.lbpStrategy;

export type CcaProductAddresses = {
  launchpad: Address | undefined;
  hook: Address | undefined;
  locker: Address | undefined;
  poolManager: Address | undefined;
  lbpStrategy: Address | undefined;
  positionManager: Address | undefined;
  universalRouter: Address;
  ccaLens: Address;
  permit2: Address;
};

/**
 * Product addresses from the existing Vite config (copied from
 * `deployments/sepolia.json`). Official Uniswap pins fill only the
 * external keys that INTERFACE_CCA already lists. Missing product
 * keys stay undefined.
 */
export function resolveCcaProductAddresses(
  env: {
    launchpadAddress?: Address;
    hookAddress?: Address;
    lockerAddress?: Address;
    poolManagerAddress?: Address;
    lbpStrategy?: Address;
    positionManager?: Address;
    universalRouter?: Address;
    ccaLens?: Address;
  } = webEnv,
): CcaProductAddresses {
  return {
    launchpad: env.launchpadAddress,
    hook: env.hookAddress,
    locker: env.lockerAddress,
    poolManager: env.poolManagerAddress ?? CCA_SEPOLIA.poolManager,
    lbpStrategy: env.lbpStrategy ?? CCA_SEPOLIA.lbpStrategy,
    positionManager: env.positionManager ?? CCA_SEPOLIA.positionManager,
    universalRouter: env.universalRouter ?? CCA_SEPOLIA.universalRouter,
    ccaLens: env.ccaLens ?? CCA_SEPOLIA.ccaLens,
    permit2: CCA_SEPOLIA.permit2,
  };
}

export function missingCcaProductKeys(addresses: CcaProductAddresses = resolveCcaProductAddresses()): string[] {
  const missing: string[] = [];
  if (!addresses.launchpad) missing.push("launchpad");
  if (!addresses.hook) missing.push("hook");
  if (!addresses.locker) missing.push("locker");
  return missing;
}

export { optionalAddress };
