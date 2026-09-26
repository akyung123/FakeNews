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
import { lockerCcaAbi, poolManagerAbi, positionManagerAbi } from "./abi/launchpadCca";
import { CCA_SEPOLIA, resolveCcaProductAddresses } from "./addresses";
import {
  auctionScheduleRequest,
  bidRead,
  deriveAuctionCopyStatus,
  deriveAuctionView,
  readAuctionLensState,
  type AuctionView,
  type CcaBid,
} from "./auction";
import { ccaAbi } from "./abi/cca";
import type { AuctionCopyStatus } from "./copy";
import { auctionOfRead, hookRead, lockerRead, lbpStrategyRead, positionManagerRead } from "./launchpadCca";
import { ccaLogsFromBlock } from "./logs";
import { bidAmountQ96ToWei } from "./price";
import {
  findLockerTokenId,
  matchLockerTokenId,
  positionManagerTransferAbi,
  tokenIdsMintedToLocker,
} from "./register";

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

  if (!launchpad) return empty("not_funded");

  try {
    if (!hook) hook = asAddress(await readContract(wagmiConfig, hookRead(launchpad)));
    if (!locker) locker = asAddress(await readContract(wagmiConfig, lockerRead(launchpad)));
    const fromPadStrategy = asAddress(await readContract(wagmiConfig, lbpStrategyRead(launchpad)).catch(() => undefined));
    if (fromPadStrategy) lbpStrategy = fromPadStrategy;
    const fromPadPm = asAddress(await readContract(wagmiConfig, positionManagerRead(launchpad)).catch(() => undefined));
    if (fromPadPm) positionManager = fromPadPm;
  } catch {
    // keep whatever we already have
  }
  if (!hook) missing.push("hook");
  if (!locker) missing.push("locker");

  const auction = asAddress(await readContract(wagmiConfig, auctionOfRead(launchpad, token)).catch(() => undefined));
  if (!auction) return { ...empty("not_funded"), hook, locker };

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
  if (locker && poolOpen) {
    try {
      tokenId = (await readContract(wagmiConfig, {
        address: locker,
        abi: lockerCcaAbi,
        functionName: "tokenIdOf",
        args: [token],
      })) as bigint;
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      if (/UnknownLock/i.test(text) && positionManager && hook) {
        needsRegister = true;
        try {
          const minted = await getContractEvents(wagmiConfig, {
            address: positionManager,
            abi: positionManagerTransferAbi,
            eventName: "Transfer",
            args: { from: zeroAddress, to: locker },
            fromBlock,
            toBlock: currentBlock,
          });
          const ids = tokenIdsMintedToLocker(minted, locker);
          for (const id of ids) {
            try {
              const [key] = (await readContract(wagmiConfig, {
                address: positionManager,
                abi: positionManagerAbi,
                functionName: "getPoolAndPositionInfo",
                args: [id],
              })) as unknown as [
                { currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address },
              ];
              if (
                matchLockerTokenId({
                  owner: locker,
                  locker,
                  token,
                  hooks: hook,
                  keyHooks: key.hooks,
                  currency0: key.currency0,
                  currency1: key.currency1,
                  fee: Number(key.fee),
                  tickSpacing: Number(key.tickSpacing),
                })
              ) {
                tokenId = id;
                break;
              }
            } catch {
              // try next mint
            }
          }
        } catch {
          // fall through to nextTokenId walk
        }
        if (tokenId == null) {
          tokenId = await findLockerTokenId(
            { readContract: (req) => readContract(wagmiConfig, req as never) },
            { positionManager, locker, token, hooks: hook },
          );
        }
      }
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
    refundWei,
    owner,
  };
}
