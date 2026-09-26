/**
 * One Sepolia RPC transport for the whole app.
 *
 * Each caller used to spin up its own `createPublicClient` (ens.ts, launched.ts,
 * wagmi.ts), so a single page load fired the same reads three times over against
 * a shared public endpoint that already rate-limits per IP (429s). This module is
 * the one place that builds transports and the one client the rest of the app reads
 * through — do not add another `createPublicClient` call elsewhere.
 */
import { createPublicClient, fallback, http, type PublicClient } from "viem";
import { sepolia } from "viem/chains";
import { webEnv } from "./env";

/** Public, no-key endpoints. rpc.sepolia.org is dead — do not add it back. */
const PUBLIC_FALLBACK_RPC_URLS = [
  "https://sepolia.gateway.tenderly.co",
  "https://ethereum-sepolia-rpc.publicnode.com",
] as const;

/** VITE_RPC_URL first, then the public fallbacks, de-duplicated. */
export function sepoliaRpcUrls(primary = webEnv.rpcUrl): string[] {
  const ordered = [primary, ...PUBLIC_FALLBACK_RPC_URLS].filter((url): url is string => Boolean(url));
  return Array.from(new Set(ordered));
}

export function sepoliaTransport(primary = webEnv.rpcUrl) {
  const urls = sepoliaRpcUrls(primary);
  const transports = urls.map((url) => http(url, { batch: true }));
  return transports.length > 1 ? fallback(transports) : transports[0];
}

/**
 * One poll per Sepolia block. viem's default (4s) polls three times per block,
 * and every watched event or block number costs a request each time.
 */
export const SEPOLIA_POLLING_MS = 12_000;

let sharedClient: PublicClient | null = null;

/** The one viem client reads should go through. Never construct a second. */
export function getPublicClient(): PublicClient {
  if (!sharedClient) {
    sharedClient = createPublicClient({
      chain: sepolia,
      transport: sepoliaTransport(),
      batch: { multicall: true },
      pollingInterval: SEPOLIA_POLLING_MS,
      cacheTime: SEPOLIA_POLLING_MS,
    });
  }
  return sharedClient;
}

/** Test-only: force the next getPublicClient() to rebuild. */
export function resetPublicClientForTests(): void {
  sharedClient = null;
}

function isRateLimited(error: unknown): boolean {
  const text = String((error as { shortMessage?: string })?.shortMessage ?? error);
  return text.includes("429") || /too many requests/i.test(text);
}

export type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

/**
 * Retries only on 429 (rate limit), with capped exponential backoff. Any other
 * error rethrows immediately — this is not a general-purpose retry-forever wrapper.
 */
export async function withRpcRetry<T>(run: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 8_000;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isRateLimited(error) || attempt === attempts - 1) throw error;
      const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      await sleep(delay);
    }
  }
  throw lastError;
}

/**
 * Share one in-flight call and reuse its result for `ttlMs`. Two screens that
 * mount together (or a quick back-and-forth) then cost one set of reads, not two.
 * A rejected call is not kept, so the next caller tries again.
 */
export function shareFor<T>(ttlMs: number, run: () => Promise<T>, now: () => number = Date.now): () => Promise<T> {
  let entry: { at: number; value: Promise<T> } | null = null;
  return () => {
    if (entry && now() - entry.at < ttlMs) return entry.value;
    const value = run();
    const current = { at: now(), value };
    entry = current;
    value.catch(() => {
      if (entry === current) entry = null;
    });
    return value;
  };
}
