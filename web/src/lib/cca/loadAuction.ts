/**
 * Load auction + migrate + locker state for one token.
 * Product addresses come from env / launchpad views; missing keys stay unset.
 */
import { zeroAddress, type Address } from "viem";
import { getAccount, getBlockNumber, getContractEvents, readContract, simulateContract } from "wagmi/actions";
import { contracts } from "../contracts";
import { v4PoolId } from "../graduation";
import { wagmiConfig } from "../wagmi";
import { lbpStrategyAbi } from "./abi/lbpStrategy";
import { poolManagerAbi } from "./abi/launchpadCca";
import { CCA_SEPOLIA, resolveCcaProductAddresses } from "./addresses";
import { getPublicClient, SEPOLIA_POLLING_MS } from "../rpc";
import {
  auctionScheduleRequest,
  bidRead,
  deriveAuctionCopyStatus,
  deriveAuctionView,
  isAuctionSoldOut,
  readAuctionLensState,
  type AuctionView,
  type CcaBid,
} from "./auction";
import { ccaAbi } from "./abi/cca";
import { SEPOLIA_BLOCK_SECONDS } from "./config";
import { CCA_COPY, type AuctionCopyStatus } from "./copy";
import { auctionBlocksRead, auctionOfRead, hookRead, lockerRead, lbpStrategyRead, positionManagerRead } from "./launchpadCca";
import { ccaLogsFromBlock, fetchCcaEventLogs } from "./logs";
import { ethPerTokenWei, isPoolOpen, poolIdForToken, slot0Request } from "./pool";
import { bidAmountQ96ToWei, q96ToWeiPerToken } from "./price";
import { POOL_PRICE_MAX_POINTS } from "./usePoolPrice";
import { findLockerTokenId, isRegisteredRead } from "./register";

export type LoadedBid = {
  id: bigint;
  bid: CcaBid;
};

export type CcaAuctionSnapshot = {
  missing: string[];
  auction?: Address;
  view?: AuctionView;
  copyStatus: AuctionCopyStatus;
  soldOut: boolean;
  finalized: boolean;
  poolOpen: boolean;
  marketFailed: boolean;
  bids: LoadedBid[];
  tokenId?: bigint;
  needsRegister: boolean;
  hook?: Address;
  locker?: Address;
  lbpStrategy?: Address;
  positionManager?: Address;
  poolManager?: Address;
  floorPriceQ96?: bigint;
  tickSpacingQ96?: bigint;
  auctionBlocks?: bigint;
  refundWei: bigint;
  owner?: Address;
};

function asAddress(value: unknown): Address | undefined {
  return typeof value === "string" && value.startsWith("0x") && value !== zeroAddress
    ? (value as Address)
    : undefined;
}

export function unusedBidWei(bid: CcaBid): bigint {
  return bidAmountQ96ToWei(bid.amountQ96);
}

export async function loadCcaAuction(token: Address): Promise<CcaAuctionSnapshot> {
  const product = resolveCcaProductAddresses();
  let hook = product.hook ?? contracts.hook;
  let locker = product.locker ?? contracts.locker;
  let lbpStrategy = product.lbpStrategy ?? contracts.lbpStrategy ?? CCA_SEPOLIA.lbpStrategy;
  let positionManager = product.positionManager ?? contracts.positionManager ?? CCA_SEPOLIA.positionManager;
  const poolManager = product.poolManager ?? contracts.poolManager ?? CCA_SEPOLIA.poolManager;
  const launchpad = product.launchpad ?? contracts.launchpad;
  const missing: string[] = [];
  if (!launchpad) missing.push("launchpad");

  let owner: Address | undefined;
  try {
    owner = getAccount(wagmiConfig).address;
  } catch {
    owner = undefined;
  }

  const empty = (status: AuctionCopyStatus): CcaAuctionSnapshot => ({
    missing,
    copyStatus: status,
    soldOut: false,
    finalized: false,
    poolOpen: false,
    marketFailed: false,
    bids: [],
    needsRegister: false,
    hook,
    locker,
    lbpStrategy,
    positionManager,
    poolManager,
    refundWei: 0n,
    owner,
  });

  let auctionBlocks: bigint | undefined;
  if (!launchpad) return empty("not_funded");

  try {
    if (!hook) hook = asAddress(await readContract(wagmiConfig, hookRead(launchpad)));
    if (!locker) locker = asAddress(await readContract(wagmiConfig, lockerRead(launchpad)));
    const fromPadStrategy = asAddress(await readContract(wagmiConfig, lbpStrategyRead(launchpad)).catch(() => undefined));
    if (fromPadStrategy) lbpStrategy = fromPadStrategy;
    const fromPadPm = asAddress(await readContract(wagmiConfig, positionManagerRead(launchpad)).catch(() => undefined));
    if (fromPadPm) positionManager = fromPadPm;
    auctionBlocks = (await readContract(wagmiConfig, auctionBlocksRead(launchpad)).catch(() => undefined)) as
      | bigint
      | undefined;
  } catch {
    // keep whatever we already have
  }
  if (!hook) missing.push("hook");
  if (!locker) missing.push("locker");

  const auction = asAddress(await readContract(wagmiConfig, auctionOfRead(launchpad, token)).catch(() => undefined));
  if (!auction) return { ...empty("not_funded"), hook, locker, auctionBlocks };

  const schedule = auctionScheduleRequest(auction);
  const [lens, startBlock, endBlock, currentBlock, floorPriceQ96, tickSpacingQ96, lastCheckpointedBlock, nextBidId, totalSupply] =
    await Promise.all([
      readAuctionLensState(
        { simulateContract: (req) => simulateContract(wagmiConfig, req as never) as never },
        auction,
        product.ccaLens ?? CCA_SEPOLIA.ccaLens,
      ),
      readContract(wagmiConfig, schedule.startBlock) as Promise<bigint>,
      readContract(wagmiConfig, schedule.endBlock) as Promise<bigint>,
      getBlockNumber(wagmiConfig),
      readContract(wagmiConfig, schedule.floorPrice) as Promise<bigint>,
      readContract(wagmiConfig, schedule.tickSpacing) as Promise<bigint>,
      readContract(wagmiConfig, schedule.lastCheckpointedBlock) as Promise<bigint>,
      readContract(wagmiConfig, schedule.nextBidId) as Promise<bigint>,
      readContract(wagmiConfig, {
        address: auction,
        abi: ccaAbi,
        functionName: "totalSupply",
      }).catch(() => 0n) as Promise<bigint>,
    ]);

  const view = deriveAuctionView({ lens, startBlock, endBlock, currentBlock });
  const soldOut = view.phase === "live" && totalSupply > 0n && lens.totalCleared >= totalSupply;
  const finalized = lastCheckpointedBlock >= endBlock;
  const fromBlock = ccaLogsFromBlock(undefined, currentBlock, startBlock);

  let poolOpen = false;
  let marketFailed = false;
  try {
    const [migratedLogs, failedLogs] = await Promise.all([
      getContractEvents(wagmiConfig, {
        address: lbpStrategy,
        abi: lbpStrategyAbi,
        eventName: "Migrated",
        args: { initializer: auction },
        fromBlock,
        toBlock: currentBlock,
      }),
      getContractEvents(wagmiConfig, {
        address: lbpStrategy,
        abi: lbpStrategyAbi,
        eventName: "MigrationFailed",
        args: { initializer: auction },
        fromBlock,
        toBlock: currentBlock,
      }),
    ]);
    poolOpen = migratedLogs.length > 0;
    marketFailed = !poolOpen && failedLogs.length > 0;
  } catch {
    // event scan optional
  }

  if (!poolOpen && hook) {
    try {
      const slot0 = (await readContract(wagmiConfig, {
        address: poolManager,
        abi: poolManagerAbi,
        functionName: "getSlot0",
        args: [v4PoolId({ token, hooks: hook })],
      })) as readonly unknown[];
      const sqrt = slot0[0] as bigint;
      if (sqrt && sqrt !== 0n) poolOpen = true;
    } catch {
      // pool not open
    }
  }

  const bids: LoadedBid[] = [];
  let refundWei = 0n;
  if (owner && nextBidId > 0n) {
    const cap = nextBidId > 32n ? 32n : nextBidId;
    const start = nextBidId - cap;
    for (let id = start; id < nextBidId; id++) {
      try {
        const bid = (await readContract(wagmiConfig, bidRead(auction, id))) as CcaBid;
        if (bid.owner.toLowerCase() !== owner.toLowerCase()) continue;
        bids.push({ id, bid });
        if (bid.exitedBlock === 0n) refundWei += unusedBidWei(bid);
      } catch {
        // skip
      }
    }
  }

  let tokenId: bigint | undefined;
  let needsRegister = false;
  if (locker && poolOpen && positionManager && hook) {
    tokenId = await findLockerTokenId(
      {
        readContract: (req) => readContract(wagmiConfig, req as never),
        getBlockNumber: async () => currentBlock,
        getContractEvents: (query) => getContractEvents(wagmiConfig, query as never),
      },
      {
        positionManager,
        locker,
        token,
        hooks: hook,
        fromBlock,
        auctionStartBlock: startBlock,
        latestBlock: currentBlock,
      },
    );
    if (tokenId != null) {
      try {
        const registered = (await readContract(wagmiConfig, isRegisteredRead(locker, token, tokenId))) as boolean;
        needsRegister = !registered;
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        needsRegister = /UnknownLock/i.test(text) || !/isRegistered/i.test(text);
      }
    } else {
      needsRegister = true;
    }
  }

  return {
    missing,
    auction,
    view,
    copyStatus: deriveAuctionCopyStatus({ view, soldOut, finalized, poolOpen, marketFailed }),
    soldOut,
    finalized,
    poolOpen,
    marketFailed,
    bids,
    tokenId,
    needsRegister,
    hook,
    locker,
    lbpStrategy,
    positionManager,
    poolManager,
    floorPriceQ96,
    tickSpacingQ96,
    auctionBlocks,
    refundWei,
    owner,
  };
}

// ---------------------------------------------------------------------------
// Light market reads for list screens (prophet page, my page).
// One block number for the whole list; per token the lens state, schedule and
// pool slot0 go out together so the shared client folds the plain reads into
// one multicall. Results are kept for one polling interval.
// ---------------------------------------------------------------------------

export const POOL_PRICE_LABEL = "Pool price";

export type MarketRow = { token: Address; auction?: Address };

export type MarketPricePoint = { at: number; wei: bigint };

export type MarketSnapshot = {
  token: Address;
  auction?: Address;
  status: AuctionCopyStatus;
  /** Inputs for auctionStatusCopy(). */
  statusVars: { n?: number; blocks?: number };
  /** "Current clearing price", "Final clearing price" or "Pool price". */
  priceLabel: string;
  /** ETH per whole token, in wei. 0 when no price is set yet. */
  priceWei: bigint;
  /** Clearing price over the auction, then pool samples seen this session. */
  history: MarketPricePoint[];
};

export type MarketReadClient = {
  getBlockNumber: () => Promise<bigint>;
  readContract: (request: never) => Promise<unknown>;
  simulateContract: (request: never) => Promise<{ result: unknown }>;
  getContractEvents?: (query: never) => Promise<unknown>;
};

export type LoadMarketOptions = {
  client?: MarketReadClient;
  launchpad?: Address;
  hook?: Address;
  ccaLens?: Address;
  /** Also read ClearingPriceUpdated logs for the chart. Off for value cards. */
  history?: boolean;
  now?: () => number;
};

const LIVE_STATUSES: readonly AuctionCopyStatus[] = ["not_funded", "not_started", "live", "sold_out"];

/** Which price a stage shows: clearing price during the auction, pool price once the market is open. */
export function marketPriceOf(input: {
  status: AuctionCopyStatus;
  clearingPriceQ96?: bigint;
  sqrtPriceX96?: bigint;
}): { priceLabel: string; priceWei: bigint } {
  if (input.status === "pool_open" && isPoolOpen(input.sqrtPriceX96)) {
    return { priceLabel: POOL_PRICE_LABEL, priceWei: ethPerTokenWei(input.sqrtPriceX96!) };
  }
  const priceWei = input.clearingPriceQ96 ? q96ToWeiPerToken(input.clearingPriceQ96) : 0n;
  return {
    priceLabel: LIVE_STATUSES.includes(input.status) ? CCA_COPY.currentClearingPrice : CCA_COPY.finalClearingPrice,
    priceWei,
  };
}

/** ClearingPriceUpdated logs → chart points. Block times are estimated from the block gap. */
export function clearingPricePoints(
  logs: readonly unknown[],
  currentBlock: bigint,
  nowSec: number,
): MarketPricePoint[] {
  const out: MarketPricePoint[] = [];
  for (const log of logs) {
    const args = (log as { args?: { blockNumber?: bigint; clearingPriceQ96?: bigint } }).args;
    if (!args || typeof args.blockNumber !== "bigint" || typeof args.clearingPriceQ96 !== "bigint") continue;
    const gap = currentBlock > args.blockNumber ? Number(currentBlock - args.blockNumber) : 0;
    out.push({ at: nowSec - gap * SEPOLIA_BLOCK_SECONDS, wei: q96ToWeiPerToken(args.clearingPriceQ96) });
  }
  return out.sort((a, b) => a.at - b.at);
}

const marketCache = new Map<string, { at: number; value: Promise<MarketSnapshot> }>();
/** Pool price samples per token for this page session (the pool keeps no price log). */
const poolSamples = new Map<Address, MarketPricePoint[]>();

/** Test-only. */
export function resetMarketCacheForTests(): void {
  marketCache.clear();
  poolSamples.clear();
}

async function readMarketSnapshot(
  row: MarketRow,
  currentBlock: bigint,
  client: MarketReadClient,
  opts: Required<Pick<LoadMarketOptions, "ccaLens" | "now">> & LoadMarketOptions,
): Promise<MarketSnapshot> {
  const nowSec = opts.now() / 1000;
  let auction = row.auction;
  if (!auction && opts.launchpad) {
    auction = asAddress(await client.readContract(auctionOfRead(opts.launchpad, row.token) as never).catch(() => undefined));
  }
  if (!auction) {
    return {
      token: row.token,
      status: "not_funded",
      statusVars: {},
      ...marketPriceOf({ status: "not_funded" }),
      history: [],
    };
  }
  const schedule = auctionScheduleRequest(auction);
  const [lens, startBlock, endBlock, lastCheckpointedBlock, totalSupply, slot0] = await Promise.all([
    readAuctionLensState({ simulateContract: client.simulateContract as never }, auction, opts.ccaLens),
    client.readContract(schedule.startBlock as never) as Promise<bigint>,
    client.readContract(schedule.endBlock as never) as Promise<bigint>,
    client.readContract(schedule.lastCheckpointedBlock as never).catch(() => undefined) as Promise<bigint | undefined>,
    client
      .readContract({ address: auction, abi: ccaAbi, functionName: "totalSupply" } as never)
      .catch(() => 0n) as Promise<bigint>,
    opts.hook
      ? client.readContract(slot0Request(poolIdForToken(row.token, opts.hook)) as never).catch(() => undefined)
      : Promise.resolve(undefined),
  ]);
  const view = deriveAuctionView({ lens, startBlock, endBlock, currentBlock });
  const sqrtPriceX96 = Array.isArray(slot0) ? (slot0[0] as bigint | undefined) : undefined;
  const poolOpen = isPoolOpen(sqrtPriceX96);
  const status = deriveAuctionCopyStatus({
    view,
    soldOut: view.phase === "live" && isAuctionSoldOut(lens.totalCleared, totalSupply),
    finalized: lastCheckpointedBlock === undefined ? undefined : lastCheckpointedBlock >= endBlock,
    poolOpen,
  });
  const price = marketPriceOf({ status, clearingPriceQ96: view.clearingPriceQ96, sqrtPriceX96 });

  let history: MarketPricePoint[] = [];
  if (opts.history && client.getContractEvents) {
    try {
      const logs = await fetchCcaEventLogs(
        {
          getBlockNumber: async () => currentBlock,
          getContractEvents: client.getContractEvents as never,
        },
        auction,
        "ClearingPriceUpdated",
        undefined,
        startBlock,
      );
      history = clearingPricePoints(logs, currentBlock, nowSec);
    } catch {
      // chart is optional; the price line above still shows
    }
  }
  if (poolOpen && price.priceWei > 0n) {
    const prev = poolSamples.get(row.token) ?? [];
    const last = prev[prev.length - 1];
    const next = last && last.wei === price.priceWei ? prev : [...prev, { at: nowSec, wei: price.priceWei }];
    poolSamples.set(row.token, next.slice(-POOL_PRICE_MAX_POINTS));
    history = [...history, ...next];
  }

  return {
    token: row.token,
    auction,
    status,
    statusVars:
      status === "live"
        ? { blocks: view.blocksRemaining }
        : status === "not_started"
          ? { n: startBlock > currentBlock ? Number(startBlock - currentBlock) : 0 }
          : {},
    ...price,
    history,
  };
}

/**
 * Stage and price for many tokens at once. A token that fails to read is left
 * out rather than shown with a made-up price.
 */
export async function loadMarketSnapshots(
  rows: readonly MarketRow[],
  options: LoadMarketOptions = {},
): Promise<Map<Address, MarketSnapshot>> {
  const out = new Map<Address, MarketSnapshot>();
  if (rows.length === 0) return out;
  const product = resolveCcaProductAddresses();
  const client = options.client ?? (getPublicClient() as unknown as MarketReadClient);
  const now = options.now ?? Date.now;
  const opts = {
    ...options,
    launchpad: options.launchpad ?? product.launchpad ?? contracts.launchpad,
    hook: options.hook ?? product.hook ?? contracts.hook,
    ccaLens: options.ccaLens ?? product.ccaLens ?? CCA_SEPOLIA.ccaLens,
    now,
  };
  const useCache = !options.client;
  let blockRead: Promise<bigint> | null = null;
  const block = () => (blockRead ??= client.getBlockNumber());

  await Promise.all(
    rows.map(async (row) => {
      const key = `${row.token.toLowerCase()}|${opts.history ? "h" : "-"}`;
      const hit = useCache ? marketCache.get(key) : undefined;
      let value: Promise<MarketSnapshot>;
      if (hit && now() - hit.at < SEPOLIA_POLLING_MS) {
        value = hit.value;
      } else {
        value = block().then((currentBlock) => readMarketSnapshot(row, currentBlock, client, opts));
        if (useCache) {
          const entry = { at: now(), value };
          marketCache.set(key, entry);
          value.catch(() => {
            if (marketCache.get(key) === entry) marketCache.delete(key);
          });
        }
      }
      try {
        out.set(row.token, await value);
      } catch {
        // leave this token out
      }
    }),
  );
  return out;
}
