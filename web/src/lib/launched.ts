/**
 * Chain-mode list: Launched logs → existing Coin card shape (INTERFACE §4).
 * Sentence comes from ENS when a resolver is set — never from Launched.
 * Curve sold / complete come from Launchpad.curve(token).
 */
import { createPublicClient, formatEther, formatUnits, http, isAddress, type Address, type PublicClient } from "viem";
import { sepolia } from "viem/chains";
import { contracts, hasLaunchpad } from "./contracts";
import { ENS_TEXT_PROPHECY, getEnsText } from "./ens";
import { webEnv } from "./env";
import { fetchLaunchedLogs } from "./launchpad";
import { launchpadAbi } from "./launchpadAbi";
import type { Coin } from "./store";

export type LaunchedLogLike = {
  args?: {
    token?: Address | string;
    prophet?: Address | string;
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
  client: Pick<PublicClient, "readContract">,
  address = contracts.launchpad,
): Promise<CurveView> {
  if (!address) return { sold: 0, ethRaised: 0, complete: false };
  const curve = (await client.readContract({
    address,
    abi: launchpadAbi,
    functionName: "curve",
    args: [token],
  })) as readonly [bigint, bigint, bigint, bigint, boolean];
  return {
    sold: Number(formatUnits(curve[3], 18)),
    ethRaised: Number(formatEther(curve[2])),
    complete: curve[4],
  };
}

export type LoadLaunchedOptions = {
  fetchLogs?: typeof fetchLaunchedLogs;
  client?: {
    getBlockNumber: () => Promise<bigint>;
    getContractEvents: (query: unknown) => Promise<unknown>;
    readContract?: PublicClient["readContract"];
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
          const curve = options.readCurve
            ? await options.readCurve(token)
            : client.readContract
              ? await readCurveView(token, client)
              : null;
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
