import { simulateContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { launchpadAbi } from "./launchpadAbi";
import { contracts } from "./contracts";
import { webEnv } from "./env";
import { wagmiConfig } from "./wagmi";
import type { Hex } from "./world";

/** Launchpad.registerProphet calldata. Label is chosen by the caller, not signed. */
export type RegisterProphetInput = {
  label: string;
  nullifier: Hex;
  serverSig: Hex;
};

export type RegisterProphetWriteRequest = ReturnType<typeof registerProphetWrite>;

export type WagmiRegisterWrite = (
  config: typeof wagmiConfig,
  request: RegisterProphetWriteRequest,
) => Promise<Hex>;

export type WagmiSimulate = (
  config: typeof wagmiConfig,
  request: RegisterProphetWriteRequest,
) => Promise<unknown>;

export type WagmiWaitForReceipt = (
  config: typeof wagmiConfig,
  args: { hash: Hex },
) => Promise<{ status?: string } | null | undefined>;

export type RegisterProphetOptions = {
  address?: `0x${string}` | undefined;
  simulateContract?: WagmiSimulate;
  writeContract?: WagmiRegisterWrite;
  waitForTransactionReceipt?: WagmiWaitForReceipt;
};

export function assertSuccessfulReceipt(receipt: { status?: string } | null | undefined): void {
  if (receipt?.status !== "success") {
    throw new Error("registerProphet did not succeed");
  }
}

export function registerProphetArgs(input: RegisterProphetInput) {
  return [input.label, BigInt(input.nullifier), input.serverSig] as const;
}

export function registerProphetWrite(input: RegisterProphetInput, address = contracts.launchpad) {
  if (!address) {
    throw new Error("Launchpad address is not set");
  }
  return {
    address,
    abi: launchpadAbi,
    functionName: "registerProphet" as const,
    args: registerProphetArgs(input),
  };
}

/** Adapter address. Deploy uses ENS_ADAPTER_ADDRESS; the web calls this view. */
export function ensAdapterRead(address = contracts.launchpad) {
  if (!address) {
    throw new Error("Launchpad address is not set");
  }
  return {
    address,
    abi: launchpadAbi,
    functionName: "ens" as const,
    args: [] as const,
  };
}

export async function readEnsAdapter(
  client: { readContract: (request: ReturnType<typeof ensAdapterRead>) => Promise<`0x${string}`> },
  address = contracts.launchpad,
): Promise<`0x${string}`> {
  return client.readContract(ensAdapterRead(address));
}

/**
 * Screen 2 write. Missing launchpad address → no-op so mock mode still issues.
 * When an address is set, send registerProphet via wagmi writeContract and wait
 * for the receipt so launch is not called before the name exists.
 * Label is not in the world/ signed payload (INTERFACE §3).
 */
export function createRegisterProphet(
  write?: (request: RegisterProphetWriteRequest) => Promise<unknown>,
  options: RegisterProphetOptions = {},
): (input: RegisterProphetInput) => Promise<void> {
  const address = "address" in options ? options.address : contracts.launchpad;
  return async (input) => {
    if (!address) return;
    const request = registerProphetWrite(input, address);
    if (write) {
      await write(request);
      return;
    }
    const simulate = options.simulateContract ?? simulateContract;
    const send = options.writeContract ?? writeContract;
    const wait = options.waitForTransactionReceipt ?? waitForTransactionReceipt;
    await simulate(wagmiConfig, request);
    const hash = await send(wagmiConfig, request);
    const receipt = await wait(wagmiConfig, { hash });
    assertSuccessfulReceipt(receipt);
  };
}

/** Recent window when VITE_LAUNCHPAD_DEPLOY_BLOCK is unset or invalid. */
export const LAUNCHED_LOOKBACK_BLOCKS = 50_000n;

/**
 * fromBlock for Launched (and later Trade) log queries.
 * A configured deploy block is used as-is. Otherwise latest − 50_000, clamp at 0 —
 * never start at genesis just because the env is missing.
 */
export function launchedFromBlock(deployBlock: bigint | undefined, latestBlock: bigint): bigint {
  if (deployBlock !== undefined) return deployBlock;
  return latestBlock > LAUNCHED_LOOKBACK_BLOCKS ? latestBlock - LAUNCHED_LOOKBACK_BLOCKS : 0n;
}

export function launchedLogsQuery(
  latestBlock: bigint,
  address = contracts.launchpad,
  deployBlock = webEnv.launchpadDeployBlock,
) {
  if (!address) {
    throw new Error("Launchpad address is not set");
  }
  return {
    address,
    abi: launchpadAbi,
    eventName: "Launched" as const,
    fromBlock: launchedFromBlock(deployBlock, latestBlock),
    toBlock: latestBlock,
  };
}

export async function fetchLaunchedLogs(
  client: {
    getBlockNumber: () => Promise<bigint>;
    getContractEvents: (query: ReturnType<typeof launchedLogsQuery>) => Promise<unknown>;
  },
  address = contracts.launchpad,
  deployBlock = webEnv.launchpadDeployBlock,
): Promise<unknown> {
  if (!address) return [];
  const latest = await client.getBlockNumber();
  return client.getContractEvents(launchedLogsQuery(latest, address, deployBlock));
}
