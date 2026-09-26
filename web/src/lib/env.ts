import { isAddress, type Address } from "viem";

function readString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readAddress(value: string | undefined): Address | undefined {
  const trimmed = readString(value);
  if (!trimmed || !isAddress(trimmed)) return undefined;
  return trimmed;
}

/** Decimal block number. Unset or invalid stays undefined — never treated as 0. */
export function readLaunchpadDeployBlock(value: string | undefined): bigint | undefined {
  const trimmed = readString(value);
  if (!trimmed || !/^[0-9]+$/.test(trimmed)) return undefined;
  return BigInt(trimmed);
}

/** Env-driven web config. Missing contract addresses stay unset — never invented. */
export const webEnv = {
  rpcUrl: readString(import.meta.env.VITE_RPC_URL),
  launchpadAddress: readAddress(import.meta.env.VITE_LAUNCHPAD_ADDRESS),
  launchpadDeployBlock: readLaunchpadDeployBlock(import.meta.env.VITE_LAUNCHPAD_DEPLOY_BLOCK),
  parentName: readString(import.meta.env.VITE_PARENT_NAME) ?? "prophecy.eth",
  universalResolver: readAddress(import.meta.env.VITE_UNIVERSAL_RESOLVER),
  walletConnectProjectId: readString(import.meta.env.VITE_WALLETCONNECT_PROJECT_ID),
};

export const SEPOLIA_CHAIN_ID = 11_155_111;
