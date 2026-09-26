/**
 * ENS reads for a prophecy name.
 *
 * Live: viem `getEnsText` / `getEnsAddress` on Sepolia through
 * `VITE_UNIVERSAL_RESOLVER` (INTERFACE §4).
 * Mock: sample records in mock.ts, same key (`prophecy`).
 *
 * The sentence lives only on the prophecy resolver (DECISIONS #5).
 */
import { createPublicClient, http, type Address, type PublicClient } from "viem";
import { sepolia } from "viem/chains";
import { normalize } from "viem/ens";
import { SEPOLIA_CHAIN_ID, webEnv } from "./env";
import { MOCK_PARENT_NAME, MOCK_PROPHECIES, MOCK_PROPHETS } from "./mock";
import { isMockMode } from "./mode";
import { getPublicClient } from "./rpc";

export const ENS_TEXT_PROPHECY = "prophecy";
/** Prophet name records (INTERFACE §1). Read only; the prophet writes them. */
export const ENS_TEXT_AVATAR = "avatar";
export const ENS_TEXT_DESCRIPTION = "description";

/**
 * An `avatar` record as an image URL. https and data images load as-is,
 * ipfs:// goes through a public gateway. Anything else (NFT URIs, http)
 * falls back to the default picture.
 */
export function avatarImageUrl(record: string | null | undefined): string | null {
  const value = record?.trim();
  if (!value) return null;
  if (/^https:\/\//i.test(value)) return value;
  if (/^data:image\//i.test(value)) return value;
  const ipfs = /^ipfs:\/\/(?:ipfs\/)?(.+)$/i.exec(value);
  if (ipfs) return `https://ipfs.io/ipfs/${ipfs[1]}`;
  return null;
}

export type EnsPublicClient = Pick<PublicClient, "getEnsText" | "getEnsAddress">;

export function prophecyMockName(slug: string, prophetLabel: string, parent = MOCK_PARENT_NAME): string {
  return `${slug}.${prophetLabel}.${parent}`;
}

export function prophetMockName(label: string, parent = MOCK_PARENT_NAME): string {
  return `${label}.${parent}`;
}

function decodeName(name: string): string {
  return name.trim().toLowerCase();
}

/** Mock ENS text store. Same keys the Universal Resolver uses on Sepolia. */
export function mockEnsText(name: string, key: string): string | null {
  const n = decodeName(name);
  if (!n) return null;
  const row = MOCK_PROPHECIES.find((item) => {
    const ens = prophecyMockName(item.slug, item.prophetLabel);
    return ens === n || item.slug === n;
  });
  if (!row) return null;
  if (key === ENS_TEXT_PROPHECY) return row.sentence;
  return null;
}

export function mockEnsAddress(name: string): Address | null {
  const n = decodeName(name);
  if (!n) return null;
  const prophecy = MOCK_PROPHECIES.find((item) => prophecyMockName(item.slug, item.prophetLabel) === n);
  if (prophecy) return prophecy.token;
  const prophet = MOCK_PROPHETS.find((item) => prophetMockName(item.label) === n || item.label === n);
  return prophet?.wallet ?? null;
}

/** Default reuses the app-wide client. Pass rpcUrl only to point a call elsewhere (tests). */
export function createEnsClient(rpcUrl?: string): PublicClient {
  if (!rpcUrl) return getPublicClient();
  return createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });
}

export function useLiveEns(): boolean {
  return Boolean(webEnv.universalResolver);
}

/** Args for wagmi `useEnsText` / viem `getEnsText` on Sepolia. */
export function ensTextQuery(name: string, key: string) {
  const resolver = webEnv.universalResolver;
  const ready = Boolean(resolver && name);
  return {
    name: ready ? normalize(name) : undefined,
    key,
    chainId: SEPOLIA_CHAIN_ID,
    universalResolverAddress: resolver,
    query: { enabled: ready },
  };
}

/**
 * Found text per client, for this page session only. A written prophecy can never
 * change (DECISIONS #5), so re-reading it on every list load only spends RPC budget.
 * Misses are not kept: a record set a moment ago still shows up on the next read.
 */
const ensTextSeen = new WeakMap<object, Map<string, string>>();

export async function getEnsText(
  name: string,
  key: string,
  options: { client?: EnsPublicClient; universalResolver?: Address } = {},
): Promise<string | null> {
  const resolver = options.universalResolver ?? webEnv.universalResolver;
  // Sample records only answer in demo mode; chain mode never shows them.
  if (!resolver) return isMockMode() ? mockEnsText(name, key) : null;
  const client = options.client ?? createEnsClient();
  const normalized = normalize(name);
  const seenKey = `${resolver.toLowerCase()}|${normalized}|${key}`;
  let seen = ensTextSeen.get(client);
  const hit = seen?.get(seenKey);
  if (hit !== undefined) return hit;
  const text = await client.getEnsText({
    name: normalized,
    key,
    universalResolverAddress: resolver,
  });
  if (text) {
    if (!seen) ensTextSeen.set(client, (seen = new Map()));
    seen.set(seenKey, text);
  }
  return text ?? null;
}

export async function getEnsAddress(
  name: string,
  options: { client?: EnsPublicClient; universalResolver?: Address } = {},
): Promise<Address | null> {
  const resolver = options.universalResolver ?? webEnv.universalResolver;
  if (!resolver) return isMockMode() ? mockEnsAddress(name) : null;
  const client = options.client ?? createEnsClient();
  const address = await client.getEnsAddress({
    name: normalize(name),
    universalResolverAddress: resolver,
    coinType: 60n,
  });
  return address ?? null;
}
