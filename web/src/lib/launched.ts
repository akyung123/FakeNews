/**
 * Chain-mode list: Launched logs → existing Coin card shape.
 * Sentence comes from ENS when a resolver is set — never from Launched.
 * On the cca branch, raised / complete come from auctionOf + CCALens.
 */
import { createPublicClient, formatEther, http, isAddress, zeroAddress, type Address, type PublicClient } from "viem";
import { sepolia } from "viem/chains";
import { auctionOfRead, readAuctionView } from "./cca";
import { contracts, hasLaunchpad } from "./contracts";
import { TOTAL_SUPPLY } from "./curve";
import { ENS_TEXT_PROPHECY, getEnsText } from "./ens";
import { webEnv } from "./env";
import { fetchLaunchedLogs } from "./launchpad";
import type { Coin } from "./store";

export type LaunchedLogLike = {
  args?: {
    token?: Address | string;
    prophet?: Address | string;
    auction?: Address | string;
    prophetLabel?: string;
    slug?: string;
  };
  blockNumber?: bigint;
};

export type CurveView = {
  sold: number;
  ethRaised: number;
  complete: boolean;
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
    createdAt: log.blockNumber != null ? Number(log.blockNumber) * 1000 : 0,
    sold: 0,
    ethRaised: 0,
    history: [],
    fromChain: true,
    auction: log.args?.auction && isAddress(log.args.auction) ? log.args.auction : undefined,
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
): Promise<CurveView> {
  if (!address) return { sold: 0, ethRaised: 0, complete: false };
  const auction = (await client.readContract(auctionOfRead(address, token))) as Address;
  if (!auction || auction === zeroAddress) return { sold: 0, ethRaised: 0, complete: false };
  if (!client.simulateContract || !client.getBlockNumber) {
    return { sold: 0, ethRaised: 0, complete: false, };
  }
  const view = await readAuctionView(
    {
      simulateContract: client.simulateContract as never,
      readContract: client.readContract as never,
      getBlockNumber: client.getBlockNumber,
    },
    auction,
  );
  const frac = view.graduationWei === 0n ? 0 : Number(view.currencyRaised) / Number(view.graduationWei);
  return {
    sold: Math.min(1, frac) * TOTAL_SUPPLY,
    ethRaised: Number(formatEther(view.currencyRaised)),
    complete: view.isGraduated,
  };
}

export type LoadLaunchedOptions = {
  fetchLogs?: typeof fetchLaunchedLogs;
  client?: {
    getBlockNumber: () => Promise<bigint>;
    getContractEvents: (query: unknown) => Promise<unknown>;
    readContract?: PublicClient["readContract"];
    simulateContract?: PublicClient["simulateContract"];
  };
  readCurve?: (token: Address) => Promise<CurveView>;
  readSentence?: (name: string) => Promise<string | null>;
};

function defaultClient(): PublicClient {
  return createPublicClient({
    chain: sepolia,
    transport: http(webEnv.rpcUrl),
  });
}

export async function loadLaunchedCoins(options: LoadLaunchedOptions = {}): Promise<Coin[]> {
  if (!hasLaunchpad() && !options.fetchLogs && !options.client) return [];
  const client = options.client ?? defaultClient();
  const logs = await (options.fetchLogs ?? fetchLaunchedLogs)(client);
  const list = Array.isArray(logs) ? logs : [];
  const coins = coinsFromLaunchedLogs(list);
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
            next = { ...next, sold: curve.sold, ethRaised: curve.ethRaised, complete: curve.complete };
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
