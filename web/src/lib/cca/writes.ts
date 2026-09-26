/**
 * Every CCA-line chain write: simulateContract, then writeContract, then
 * wait for the receipt and throw unless status === 'success'.
 * Mirrors `createRegisterProphet` in `web/src/lib/launchpad.ts`.
 */
import { simulateContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { wagmiConfig } from "../wagmi";
import type { Hex } from "../world";
import { onSepolia, switchWalletToSepolia } from "../chain";

export type CcaWriteRequest = {
  address: `0x${string}`;
  chainId?: number;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
};

export type WagmiCcaWrite = (config: typeof wagmiConfig, request: CcaWriteRequest) => Promise<Hex>;

export type WagmiCcaSimulate = (config: typeof wagmiConfig, request: CcaWriteRequest) => Promise<unknown>;

export type CcaReceipt = {
  status?: string;
  logs?: readonly {
    address?: `0x${string}`;
    topics?: readonly Hex[];
    data?: Hex;
  }[];
};

export type WagmiCcaWait = (
  config: typeof wagmiConfig,
  args: { hash: Hex },
) => Promise<CcaReceipt | null | undefined>;

export type CcaWriteOptions = {
  simulateContract?: WagmiCcaSimulate;
  writeContract?: WagmiCcaWrite;
  waitForTransactionReceipt?: WagmiCcaWait;
  ensureSepolia?: () => Promise<boolean>;
};

export type CcaWriteResult = {
  hash: Hex;
  receipt: CcaReceipt;
};

export function assertSuccessfulReceipt(
  receipt: { status?: string } | null | undefined,
  label: string,
): void {
  if (receipt?.status !== "success") {
    throw new Error(`${label} did not succeed`);
  }
}

export async function sendCcaWriteResult(
  request: CcaWriteRequest,
  label: string,
  options: CcaWriteOptions = {},
): Promise<CcaWriteResult> {
  const mocked = Boolean(options.simulateContract || options.writeContract);
  if (!mocked) {
    // wagmi switchChain(11155111) when the wallet is elsewhere; the request also pins chainId.
    const ready = await (options.ensureSepolia ?? (() => switchWalletToSepolia()))();
    if (!ready) throw new Error("Switch to Sepolia");
  }
  const simulate = options.simulateContract ?? ((config, req) => simulateContract(config, req as never));
  const send = options.writeContract ?? ((config, req) => writeContract(config, req as never));
  const wait = options.waitForTransactionReceipt ?? waitForTransactionReceipt;
  const pinned = onSepolia(request);
  await simulate(wagmiConfig, pinned);
  const hash = await send(wagmiConfig, pinned);
  const receipt = (await wait(wagmiConfig, { hash })) ?? {};
  assertSuccessfulReceipt(receipt, label);
  return { hash, receipt };
}

export async function sendCcaWrite(
  request: CcaWriteRequest,
  label: string,
  options: CcaWriteOptions = {},
): Promise<Hex> {
  const { hash } = await sendCcaWriteResult(request, label, options);
  return hash;
}
