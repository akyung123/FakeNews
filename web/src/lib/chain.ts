/**
 * Every write goes to Sepolia (AGENTS rule 4). Requests carry
 * `chainId: sepolia.id`, and a wallet on another chain is switched with
 * wagmi `switchChain(11155111)` before anything is simulated or sent.
 */
import { getAccount, switchChain } from "wagmi/actions";
import { sepolia } from "wagmi/chains";
import { wagmiConfig } from "./wagmi";

export const WRITE_CHAIN_ID = sepolia.id;

/** The request with `chainId: sepolia.id`, so wagmi refuses to send it on another chain. */
export function onSepolia<T extends object>(request: T): T & { chainId: typeof sepolia.id } {
  return { ...request, chainId: WRITE_CHAIN_ID };
}

export type SwitchChainDeps = {
  getChainId?: () => number | undefined;
  switchChain?: (chainId: typeof sepolia.id) => Promise<unknown>;
};

/**
 * Switch the connected wallet to Sepolia when it is on another chain. With no
 * wallet connected there is nothing to switch; the write itself then asks to connect.
 * Resolves true when the wallet is on Sepolia (or not connected yet).
 */
export async function switchWalletToSepolia(deps: SwitchChainDeps = {}): Promise<boolean> {
  const chainIdOf = deps.getChainId ?? (() => getAccount(wagmiConfig).chainId);
  const current = chainIdOf();
  if (current === undefined || current === WRITE_CHAIN_ID) return true;
  try {
    await (deps.switchChain ?? ((chainId) => switchChain(wagmiConfig, { chainId })))(WRITE_CHAIN_ID);
  } catch {
    return false;
  }
  const after = chainIdOf();
  return after === undefined || after === WRITE_CHAIN_ID;
}

/** Throws "Switch to Sepolia" when the wallet stays on another chain. */
export async function requireSepolia(deps: SwitchChainDeps = {}): Promise<void> {
  if (!(await switchWalletToSepolia(deps))) throw new Error("Switch to Sepolia");
}
