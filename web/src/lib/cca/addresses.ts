/**
 * Fixed Sepolia addresses — INTERFACE_CCA.md §0.1
 * Official Uniswap / CCA pins. Product addresses (launchpad, hook, locker)
 * come from env copied out of `deployments/sepolia.json` and stay unset
 * until that file / Vite var exists. Do not invent them.
 */
import { isAddress, zeroAddress, type Address } from "viem";
import { webEnv } from "../env";

function optionalAddress(value: string | undefined): Address | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !isAddress(trimmed) || trimmed.toLowerCase() === zeroAddress) return undefined;
  return trimmed;
}

/** Infra `deployments/sepolia.json` after a person broadcasts (INTERFACE §5). */
export type SepoliaDeploymentRecord = {
  launchpad?: string;
  launchpadBlock?: number | string;
  hook?: string;
  locker?: string;
  poolManager?: string;
  lbpStrategy?: string;
  positionManager?: string;
  universalRouter?: string;
  ccaLens?: string;
  contracts?: {
    Launchpad?: string;
    ProphecyHook?: string;
    LiquidityLocker?: string;
  };
};

export function addressesFromDeploymentRecord(record: SepoliaDeploymentRecord | undefined): {
  launchpadAddress?: Address;
  hookAddress?: Address;
  lockerAddress?: Address;
  poolManagerAddress?: Address;
  lbpStrategy?: Address;
  positionManager?: Address;
  universalRouter?: Address;
  ccaLens?: Address;
} {
  if (!record) return {};
  return {
    launchpadAddress: optionalAddress(record.launchpad ?? record.contracts?.Launchpad),
    hookAddress: optionalAddress(record.hook ?? record.contracts?.ProphecyHook),
    lockerAddress: optionalAddress(record.locker ?? record.contracts?.LiquidityLocker),
    poolManagerAddress: optionalAddress(record.poolManager),
    lbpStrategy: optionalAddress(record.lbpStrategy),
    positionManager: optionalAddress(record.positionManager),
    universalRouter: optionalAddress(record.universalRouter),
    ccaLens: optionalAddress(record.ccaLens),
  };
}

/**
 * The deployment record lives at the repo root, outside this Vite project, so
 * it is injected at build time (`__SEPOLIA_DEPLOYMENT__` in `vite.config.ts`)
 * rather than imported. Undefined under a plain test runner, which is fine:
 * every caller falls back to env or to the official addresses.
 */
declare const __SEPOLIA_DEPLOYMENT__: SepoliaDeploymentRecord | null | undefined;

function bundledSepoliaDeployment(): SepoliaDeploymentRecord | undefined {
  const record = typeof __SEPOLIA_DEPLOYMENT__ === "undefined" ? undefined : __SEPOLIA_DEPLOYMENT__;
  return record && typeof record === "object" ? record : undefined;
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
  deployment: SepoliaDeploymentRecord | undefined = bundledSepoliaDeployment(),
): CcaProductAddresses {
  const fromFile = addressesFromDeploymentRecord(deployment);
  return {
    launchpad: env.launchpadAddress ?? fromFile.launchpadAddress,
    hook: env.hookAddress ?? fromFile.hookAddress,
    locker: env.lockerAddress ?? fromFile.lockerAddress,
    poolManager: env.poolManagerAddress ?? fromFile.poolManagerAddress ?? CCA_SEPOLIA.poolManager,
    lbpStrategy: env.lbpStrategy ?? fromFile.lbpStrategy ?? CCA_SEPOLIA.lbpStrategy,
    positionManager: env.positionManager ?? fromFile.positionManager ?? CCA_SEPOLIA.positionManager,
    universalRouter: env.universalRouter ?? fromFile.universalRouter ?? CCA_SEPOLIA.universalRouter,
    ccaLens: env.ccaLens ?? fromFile.ccaLens ?? CCA_SEPOLIA.ccaLens,
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
