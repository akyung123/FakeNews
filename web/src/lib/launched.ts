/**
 * Chain-mode list: Launched logs → existing Coin card shape.
 * Sentence comes from ENS when a resolver is set — never from Launched.
 * On the cca branch, raised / complete come from auctionOf + CCALens.
 */
import { formatEther, isAddress, zeroAddress, type Address, type PublicClient } from "viem";
import { auctionOfRead, q96ToWeiPerToken, readAuctionView } from "./cca";
import { ethPerTokenWei, isPoolOpen, poolIdForToken, slot0Request } from "./cca/pool";
import { contracts, hasLaunchpad } from "./contracts";
import { TOTAL_SUPPLY } from "./curve";
import { ENS_TEXT_PROPHECY, getEnsText } from "./ens";
import { webEnv } from "./env";
import { fetchLaunchedLogs, fetchLaunchedLogsChunked } from "./launchpad";
import { getPublicClient, shareFor, SEPOLIA_POLLING_MS } from "./rpc";
import type { Coin } from "./store";

export type LaunchedLogLike = {
  args?: {
    token?: Address | string;
    prophet?: Address | string;
    auction?: Address | string;
    prophetLabel?: string;
    slug?: string;
  };
  blockNumber?: bigint | null;
  /** Seconds. Some RPCs include it on logs; otherwise it is read from the block. */
  blockTimestamp?: bigint | null;
};

export type CurveView = {
  sold: number;
  ethRaised: number;
  complete: boolean;
  raisedWei?: bigint;
  priceWei?: bigint;
  endBlock?: number;
  readBlock?: number;
  marketOpen?: boolean;
};

export function coinFromLaunchedLog(log: LaunchedLogLike, parentName = webEnv.parentName): Coin | null {
  const token = log.args?.token;
  const slug = log.args?.slug;
  if (!token || !isAddress(token) || !slug) return null;
  const label = log.args?.prophetLabel ?? "";
  const name = label ? `${slug}.${label}.${parentName}` : slug;
  return {
    id: token,
    token,
    name,
    ticker: slug.toUpperCase().slice(0, 11),
    prophecy: "",
    creator: label,
    // Launch time is the block's timestamp. 0 until it is known, so the UI hides "ago".
    createdAt: log.blockTimestamp != null ? Number(log.blockTimestamp) * 1000 : 0,
    sold: 0,
    ethRaised: 0,
    history: [],
    fromChain: true,
    auction: log.args?.auction && isAddress(log.args.auction) ? log.args.auction : undefined,
    prophet: log.args?.prophet && isAddress(log.args.prophet) ? log.args.prophet : undefined,
    launchedBlock: log.blockNumber != null ? Number(log.blockNumber) : undefined,
  };
}

export function coinsFromLaunchedLogs(logs: readonly unknown[]): Coin[] {
  const out: Coin[] = [];
  for (const log of logs) {
    const coin = coinFromLaunchedLog(log as LaunchedLogLike);
    if (coin) out.push(coin);
  }
  return out;
}

export function findLaunchedCoin(lookup: string, coins: readonly Coin[]): Coin | undefined {
  const key = lookup.trim().toLowerCase();
  if (!key) return undefined;
  return coins.find(
    (c) =>
      c.id.toLowerCase() === key ||
      c.name.toLowerCase() === key ||
      (c.token != null && c.token.toLowerCase() === key),
  );
}

export async function readCurveView(
  token: Address,
  client: Pick<PublicClient, "readContract"> & {
    simulateContract?: (request: unknown) => Promise<{ result: unknown }>;
    getBlockNumber?: () => Promise<bigint>;
  },
  address = contracts.launchpad,
  hook = contracts.hook,
): Promise<CurveView> {
  if (!address) return { sold: 0, ethRaised: 0, complete: false };
  const auction = (await client.readContract(auctionOfRead(address, token))) as Address;
  if (!auction || auction === zeroAddress) return { sold: 0, ethRaised: 0, complete: false };
  if (!client.simulateContract || !client.getBlockNumber) {
    return { sold: 0, ethRaised: 0, complete: false, };
  }
  let readBlock: bigint | undefined;
  const getBlockNumber = client.getBlockNumber;
  const view = await readAuctionView(
    {
      simulateContract: client.simulateContract as never,
      readContract: client.readContract as never,
      getBlockNumber: async () => (readBlock = await getBlockNumber()),
    },
    auction,
  );
  const frac = view.graduationWei === 0n ? 0 : Number(view.currencyRaised) / Number(view.graduationWei);
  const ended = view.phase === "ended_goal_reached" || view.phase === "ended_goal_not_reached";
  let marketOpen = false;
  let priceWei = view.clearingPriceQ96 > 0n ? q96ToWeiPerToken(view.clearingPriceQ96) : 0n;
  if (ended && view.goalReached && hook) {
    try {
      const slot0 = (await client.readContract(slot0Request(poolIdForToken(token, hook)) as never)) as unknown;
      const sqrt = Array.isArray(slot0) ? (slot0[0] as bigint | undefined) : undefined;
      if (isPoolOpen(sqrt)) {
        marketOpen = true;
        priceWei = ethPerTokenWei(sqrt!);
      }
    } catch {
      // pool not open or unreadable: keep the final clearing price
    }
  }
  return {
    sold: Math.min(1, frac) * TOTAL_SUPPLY,
    ethRaised: Number(formatEther(view.currencyRaised)),
    complete: view.isGraduated,
    raisedWei: view.currencyRaised,
    priceWei,
    endBlock: Number(view.endBlock),
    readBlock: readBlock != null ? Number(readBlock) : undefined,
    marketOpen,
  };
}

export type LoadLaunchedOptions = {
  fetchLogs?: typeof fetchLaunchedLogs;
  client?: {
    getBlockNumber: () => Promise<bigint>;
    getContractEvents: (query: unknown) => Promise<unknown>;
    readContract?: PublicClient["readContract"];
    simulateContract?: PublicClient["simulateContract"];
    getBlock?: (args: { blockNumber: bigint }) => Promise<{ timestamp: bigint }>;
  };
  readCurve?: (token: Address) => Promise<CurveView>;
  readSentence?: (name: string) => Promise<string | null>;
  /** Skip the one-block shared result, e.g. right after a launch. */
  fresh?: boolean;
};

/** Block number → timestamp (ms). A block's time never changes, so it is kept for the session. */
const blockTimes = new Map<bigint, number>();

/** Test-only. */
export function resetBlockTimesForTests(): void {
  blockTimes.clear();
}

/**
 * Fill `createdAt` from the Launched block's timestamp. A row whose block
 * cannot be read keeps 0, and the UI hides its "ago" line.
 */
export async function fillLaunchTimes(
  coins: Coin[],
  getBlock: ((args: { blockNumber: bigint }) => Promise<{ timestamp: bigint }>) | undefined,
): Promise<Coin[]> {
  const missing = new Set<bigint>();
  for (const coin of coins) {
    if (coin.createdAt > 0 || coin.launchedBlock == null) continue;
    const block = BigInt(coin.launchedBlock);
    if (!blockTimes.has(block)) missing.add(block);
  }
  if (getBlock && missing.size > 0) {
    await Promise.all(
      [...missing].map(async (blockNumber) => {
        try {
          const { timestamp } = await getBlock({ blockNumber });
          blockTimes.set(blockNumber, Number(timestamp) * 1000);
        } catch {
          // leave it unknown
        }
      }),
    );
  }
  return coins.map((coin) => {
    if (coin.createdAt > 0 || coin.launchedBlock == null) return coin;
    const at = blockTimes.get(BigInt(coin.launchedBlock));
    return at ? { ...coin, createdAt: at } : coin;
  });
}

function defaultClient(): PublicClient {
  return getPublicClient();
}

/** Home and a coin page both load the list; navigating between them reuses it for one block. */
const loadLaunchedCoinsShared = shareFor(SEPOLIA_POLLING_MS, () => readLaunchedCoins({}));

export function loadLaunchedCoins(options: LoadLaunchedOptions = {}): Promise<Coin[]> {
  const { fresh, ...rest } = options;
  return Object.keys(rest).length === 0 && !fresh ? loadLaunchedCoinsShared() : readLaunchedCoins(rest);
}

async function readLaunchedCoins(options: LoadLaunchedOptions): Promise<Coin[]> {
  if (!hasLaunchpad() && !options.fetchLogs && !options.client) return [];
  const client = options.client ?? defaultClient();
  const logs = await (options.fetchLogs ?? fetchLaunchedLogsChunked)(client);
  const list = Array.isArray(logs) ? logs : [];
  for (const log of list) {
    const row = log as LaunchedLogLike;
    if (row.blockNumber != null && row.blockTimestamp != null) {
      blockTimes.set(row.blockNumber, Number(row.blockTimestamp) * 1000);
    }
  }
  const getBlock = client.getBlock ? (args: { blockNumber: bigint }) => client.getBlock!(args) : undefined;
  const coins = await fillLaunchTimes(coinsFromLaunchedLogs(list), getBlock);
  return Promise.all(
    coins.map(async (coin) => {
      const token = coin.token;
      let next = { ...coin };
      if (token) {
        try {
          const read = options.readCurve
            ? options.readCurve
            : typeof client.readContract === "function"
              ? (t: Address) => {
                  const simulate = client.simulateContract;
                  return readCurveView(t, {
                    readContract: client.readContract as PublicClient["readContract"],
                    simulateContract: simulate
                      ? (request) => simulate(request as never)
                      : undefined,
                    getBlockNumber: client.getBlockNumber,
                  });
                }
              : null;
          const curve = read ? await read(token) : null;
          if (curve) {
            next = {
              ...next,
              sold: curve.sold,
              ethRaised: curve.ethRaised,
              complete: curve.complete,
              raisedWei: curve.raisedWei,
              priceWei: curve.priceWei,
              endBlock: curve.endBlock,
              readBlock: curve.readBlock,
              marketOpen: curve.marketOpen,
            };
          }
        } catch {
          // keep zeros; list still shows the token
        }
      }
      if (next.name.includes(".")) {
        try {
          const sentence = options.readSentence
            ? await options.readSentence(next.name)
            : await getEnsText(next.name, ENS_TEXT_PROPHECY);
          if (sentence) next = { ...next, prophecy: sentence };
        } catch {
          // sentence lives only in ENS; leave empty rather than invent one
        }
      }
      return next;
    }),
  );
}
