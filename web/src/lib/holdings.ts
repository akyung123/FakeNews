/**
 * Value cards on My page (`/me`), chain mode. All figures in ETH wei.
 *
 * Reads, in as few round trips as the shared client allows:
 *   - Launched list (shared with Home)
 *   - balanceOf for every token (one multicall)
 *   - stage and price for held tokens only (loadMarketSnapshots)
 *   - BidSubmitted / BidExited for this wallet across every auction at once
 *     (one getLogs per event per block window, owner is an indexed topic)
 *   - prophetOf, then Locker.accruedEth when the wallet is a prophet
 * The whole result is kept per wallet for 30 seconds.
 */
import { erc20Abi, type Address } from "viem";
import { ccaAbi } from "./cca/abi/cca";
import { lockerCcaAbi } from "./cca/abi/launchpadCca";
import { loadMarketSnapshots, type MarketRow, type MarketSnapshot } from "./cca/loadAuction";
import { ccaLogChunks, ccaLogsFromBlock } from "./cca/logs";
import { contracts } from "./contracts";
import { loadLaunchedCoins } from "./launched";
import { launchpadAbi } from "./launchpadAbi";
import { getPublicClient, withRpcRetry } from "./rpc";
import type { Coin } from "./store";

const WAD = 10n ** 18n;
export const HOLDINGS_TTL_MS = 30_000;

export type MyHoldings = {
  /** Σ balance × current price (clearing price or pool price). */
  holdingsValueWei: bigint;
  /** Σ balances across every prophecy token, 18 decimals. */
  tokensHeldWei: bigint;
  /** Σ BidSubmitted.amount − Σ BidExited.currencyRefunded, never below 0. */
  bidSpentWei: bigint;
  /** Locker.accruedEth for a prophet; null when the wallet has no prophet name. */
  feesWei: bigint | null;
  /** Every prophecy token this wallet holds (bids claimed, swaps, transfers), largest value first. */
  held?: HeldRow[];
  /** Prophecies this wallet launched, newest first, held or not. */
  launched?: LaunchedRow[];
};

export type HeldRow = {
  coin: Coin & { token: Address };
  balanceWei: bigint;
  /** Clearing price or pool price, per whole token. 0 when unknown. */
  priceWei: bigint;
  valueWei: bigint;
  launchedByYou: boolean;
};

export type LaunchedRow = {
  coin: Coin & { token: Address };
  balanceWei: bigint;
};

export type HoldingsReadClient = {
  getBlockNumber: () => Promise<bigint>;
  readContract: (request: never) => Promise<unknown>;
  getContractEvents: (query: never) => Promise<unknown>;
};

export type LoadHoldingsOptions = {
  client?: HoldingsReadClient;
  loadCoins?: () => Promise<Coin[]>;
  loadMarkets?: (rows: MarketRow[]) => Promise<Map<Address, MarketSnapshot>>;
  launchpad?: Address;
  locker?: Address;
};

type LogWithArgs = { args?: Record<string, unknown> };

function sumArg(logs: readonly unknown[], key: string): bigint {
  let total = 0n;
  for (const log of logs) {
    const value = (log as LogWithArgs).args?.[key];
    if (typeof value === "bigint") total += value;
  }
  return total;
}

async function ownerLogs(
  client: HoldingsReadClient,
  auctions: Address[],
  eventName: "BidSubmitted" | "BidExited",
  owner: Address,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<unknown[]> {
  const out: unknown[] = [];
  for (const chunk of ccaLogChunks(fromBlock, toBlock)) {
    const part = await withRpcRetry(() =>
      client.getContractEvents({
        address: auctions,
        abi: ccaAbi,
        eventName,
        args: { owner },
        fromBlock: chunk.fromBlock,
        toBlock: chunk.toBlock,
      } as never),
    );
    if (Array.isArray(part)) out.push(...part);
  }
  return out;
}

export async function readMyHoldings(wallet: Address, options: LoadHoldingsOptions = {}): Promise<MyHoldings> {
  const client = options.client ?? (getPublicClient() as unknown as HoldingsReadClient);
  const launchpad = options.launchpad ?? contracts.launchpad;
  const locker = options.locker ?? contracts.locker;
  const coins = (await (options.loadCoins ?? (() => loadLaunchedCoins()))()).filter(
    (c): c is Coin & { token: Address } => Boolean(c.fromChain && c.token),
  );
  const auctions = coins.map((c) => c.auction).filter((a): a is Address => Boolean(a));

  const balancesRead = Promise.all(
    coins.map((c) =>
      client
        .readContract({ address: c.token, abi: erc20Abi, functionName: "balanceOf", args: [wallet] } as never)
        .then((v) => (typeof v === "bigint" ? v : 0n))
        .catch(() => 0n),
    ),
  );
  const labelRead = launchpad
    ? client
        .readContract({ address: launchpad, abi: launchpadAbi, functionName: "prophetOf", args: [wallet] } as never)
        .then((v) => (typeof v === "string" ? v : ""))
        .catch(() => "")
    : Promise.resolve("");
  const bidsRead = (async () => {
    if (auctions.length === 0) return { submitted: [] as unknown[], exited: [] as unknown[] };
    const latest = await client.getBlockNumber();
    const from = ccaLogsFromBlock(undefined, latest);
    const [submitted, exited] = await Promise.all([
      ownerLogs(client, auctions, "BidSubmitted", wallet, from, latest),
      ownerLogs(client, auctions, "BidExited", wallet, from, latest),
    ]);
    return { submitted, exited };
  })().catch(() => ({ submitted: [] as unknown[], exited: [] as unknown[] }));

  const [balances, label, bids] = await Promise.all([balancesRead, labelRead, bidsRead]);

  const held: { token: Address; auction?: Address; balance: bigint; coin: Coin & { token: Address } }[] = [];
  coins.forEach((c, i) => {
    if (balances[i] > 0n) held.push({ token: c.token, auction: c.auction, balance: balances[i], coin: c });
  });
  const mine = (c: Coin) => Boolean(c.prophet && c.prophet.toLowerCase() === wallet.toLowerCase());
  const markets = held.length
    ? await (options.loadMarkets ?? ((rows) => loadMarketSnapshots(rows)))(
        held.map(({ token, auction }) => ({ token, auction })),
      ).catch(() => new Map<Address, MarketSnapshot>())
    : new Map<Address, MarketSnapshot>();

  let holdingsValueWei = 0n;
  let tokensHeldWei = 0n;
  const heldRows: HeldRow[] = [];
  for (const row of held) {
    tokensHeldWei += row.balance;
    const price = markets.get(row.token)?.priceWei ?? 0n;
    const value = (row.balance * price) / WAD;
    holdingsValueWei += value;
    heldRows.push({ coin: row.coin, balanceWei: row.balance, priceWei: price, valueWei: value, launchedByYou: mine(row.coin) });
  }
  heldRows.sort((a, b) => (b.valueWei > a.valueWei ? 1 : b.valueWei < a.valueWei ? -1 : b.balanceWei > a.balanceWei ? 1 : -1));
  const launchedRows: LaunchedRow[] = coins
    .map((coin, i) => ({ coin, balanceWei: balances[i] ?? 0n }))
    .filter((row) => mine(row.coin))
    .sort((a, b) => (b.coin.launchedBlock ?? 0) - (a.coin.launchedBlock ?? 0));

  const spent = sumArg(bids.submitted, "amount") - sumArg(bids.exited, "currencyRefunded");

  let feesWei: bigint | null = null;
  if (label && locker) {
    feesWei = await client
      .readContract({ address: locker, abi: lockerCcaAbi, functionName: "accruedEth", args: [wallet] } as never)
      .then((v) => (typeof v === "bigint" ? v : 0n))
      .catch(() => 0n);
  } else if (label) {
    feesWei = 0n;
  }

  return {
    holdingsValueWei,
    tokensHeldWei,
    bidSpentWei: spent > 0n ? spent : 0n,
    feesWei,
    held: heldRows,
    launched: launchedRows,
  };
}

const cache = new Map<string, { at: number; value: Promise<MyHoldings> }>();

/** Test-only. */
export function resetHoldingsCacheForTests(): void {
  cache.clear();
}

/** Cached per wallet so moving between screens does not re-read everything. */
export function loadMyHoldings(wallet: Address, now: () => number = Date.now): Promise<MyHoldings> {
  const key = wallet.toLowerCase();
  const hit = cache.get(key);
  if (hit && now() - hit.at < HOLDINGS_TTL_MS) return hit.value;
  const value = readMyHoldings(wallet);
  const entry = { at: now(), value };
  cache.set(key, entry);
  value.catch(() => {
    if (cache.get(key) === entry) cache.delete(key);
  });
  return value;
}
