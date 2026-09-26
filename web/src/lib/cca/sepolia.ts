/**
 * EIP-1193 Sepolia gate. Writes wait until chainId is 11155111.
 * Wrong chain: wallet_switchEthereumChain, then wallet_addEthereumChain on 4902.
 */
import { SEPOLIA_CHAIN_ID } from "../env";
import { sepoliaRpcUrls } from "../rpc";

export const SEPOLIA_HEX_CHAIN_ID = "0xaa36a7";

export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
};

export const SEPOLIA_ADD_CHAIN_PARAMS = {
  chainId: SEPOLIA_HEX_CHAIN_ID,
  chainName: "Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: sepoliaRpcUrls(),
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
} as const;

export function parseProviderChainId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = value.startsWith("0x") || value.startsWith("0X") ? Number.parseInt(value, 16) : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function isUnrecognizedChainError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? (error as { code?: unknown }).code : undefined;
  return code === 4902 || code === "4902";
}

export function injectedProvider(
  source: { ethereum?: Eip1193Provider } = globalThis as { ethereum?: Eip1193Provider },
): Eip1193Provider | undefined {
  return source.ethereum;
}

export async function readProviderChainId(provider: Eip1193Provider): Promise<number | undefined> {
  return parseProviderChainId(await provider.request({ method: "eth_chainId" }));
}

export function isSepoliaChainId(chainId: number | undefined): boolean {
  return chainId === SEPOLIA_CHAIN_ID;
}

export async function ensureSepoliaChain(
  provider: Eip1193Provider | undefined = injectedProvider(),
): Promise<boolean> {
  if (!provider) return false;
  if (isSepoliaChainId(await readProviderChainId(provider))) return true;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_HEX_CHAIN_ID }],
    });
  } catch (error) {
    if (!isUnrecognizedChainError(error)) return false;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [SEPOLIA_ADD_CHAIN_PARAMS],
    });
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_HEX_CHAIN_ID }],
    });
  }
  return isSepoliaChainId(await readProviderChainId(provider));
}
