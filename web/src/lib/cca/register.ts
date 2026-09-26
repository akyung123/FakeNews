/**
 * Permissionless locker.register(token, tokenId) after migrate.
 * Official PositionManager `_mint` does not call onERC721Received.
 *
 * tokenId comes from the PositionManager ERC-721
 * `Transfer(from=0x0, to=locker, tokenId)` log:
 *   1. migrate receipt, when we just sent it
 *   2. otherwise a chunked log query (50_000-block windows, same as the lib)
 *      matched to the pool / token
 */
import { parseEventLogs, zeroAddress, type Address, type Log } from "viem";
import { lockerCcaAbi, positionManagerAbi } from "./abi/launchpadCca";
import { POOL_FEE, POOL_TICK_SPACING } from "./config";
import { ccaLogChunks, ccaLogsFromBlock } from "./logs";
import { sendCcaWrite, type CcaReceipt, type CcaWriteOptions, type CcaWriteRequest } from "./writes";
import type { Hex } from "../world";

export const positionManagerTransferAbi = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
] as const;

export const LOCKER_TOKEN_ID_SCAN = 32n;

export function registerLockerWrite(locker: Address, token: Address, tokenId: bigint): CcaWriteRequest {
  return {
    address: locker,
    abi: lockerCcaAbi,
    functionName: "register",
    args: [token, tokenId],
  };
}

export async function registerLocker(
  locker: Address,
  token: Address,
  tokenId: bigint,
  options: CcaWriteOptions = {},
): Promise<Hex> {
  return sendCcaWrite(registerLockerWrite(locker, token, tokenId), "register", options);
}

function isMintToLocker(
  row: {
    eventName?: string;
    address?: Address;
    args: { from?: Address; to?: Address; tokenId?: bigint };
  },
  locker: Address,
  positionManager?: Address,
): boolean {
  if (row.eventName !== "Transfer" || row.args.from !== zeroAddress || row.args.tokenId == null) {
    return false;
  }
  if (!row.args.to || row.args.to.toLowerCase() !== locker.toLowerCase()) return false;
  if (positionManager && row.address && row.address.toLowerCase() !== positionManager.toLowerCase()) {
    return false;
  }
  return true;
}

/** PositionManager mint Transfers to the locker. Optional address filter. */
export function tokenIdsMintedToLocker(
  logs: readonly unknown[],
  locker: Address,
  positionManager?: Address,
): bigint[] {
  try {
    const parsed = parseEventLogs({
      abi: positionManagerTransferAbi,
      logs: logs as Log[],
      strict: false,
    });
    return parsed
      .filter((row) => isMintToLocker(row, locker, positionManager))
      .map((row) => BigInt(row.args.tokenId!));
  } catch {
    return [];
  }
}

/**
 * tokenId for `register(token, tokenId)` from the migrate receipt.
 * Official `_mint` emits Transfer(from=0x0, to=locker, tokenId) with no callback.
 */
export function tokenIdFromMigrateReceipt(
  receipt: CcaReceipt | { logs?: readonly unknown[] },
  locker: Address,
  positionManager?: Address,
): bigint | undefined {
  const ids = tokenIdsMintedToLocker(receipt.logs ?? [], locker, positionManager);
  if (ids.length === 0) return undefined;
  return ids[ids.length - 1];
}

export function positionManagerMintLogsQuery(
  positionManager: Address,
  locker: Address,
  toBlock: bigint,
  fromBlock: bigint,
) {
  return {
    address: positionManager,
    abi: positionManagerTransferAbi,
    eventName: "Transfer" as const,
    args: { from: zeroAddress, to: locker },
    fromBlock,
    toBlock,
  };
}

/**
 * Reload path: Transfer(from=0x0, to=locker) on PositionManager,
 * chunked in 50_000-block windows (same lookback as other CCA logs).
 */
export async function fetchPositionManagerMintLogs(
  client: {
    getBlockNumber: () => Promise<bigint>;
    getContractEvents: (query: ReturnType<typeof positionManagerMintLogsQuery>) => Promise<unknown>;
  },
  positionManager: Address,
  locker: Address,
  fromBlock?: bigint,
  auctionStartBlock?: bigint,
  latestBlock?: bigint,
): Promise<unknown[]> {
  const toBlock = latestBlock ?? (await client.getBlockNumber());
  const lookback = ccaLogsFromBlock(undefined, toBlock, auctionStartBlock);
  const rangeStart = fromBlock === undefined ? lookback : fromBlock > lookback ? fromBlock : lookback;
  const out: unknown[] = [];
  for (const chunk of ccaLogChunks(rangeStart, toBlock)) {
    const part = await client.getContractEvents(
      positionManagerMintLogsQuery(positionManager, locker, chunk.toBlock, chunk.fromBlock),
    );
    if (Array.isArray(part)) out.push(...part);
    else out.push(part);
  }
  return out;
}

export function isRegisteredRead(locker: Address, token: Address, tokenId: bigint) {
  return {
    address: locker,
    abi: lockerCcaAbi,
    functionName: "isRegistered" as const,
    args: [token, tokenId] as const,
  };
}

export function lockerRegisteredLogsQuery(
  locker: Address,
  token: Address,
  toBlock: bigint,
  fromBlock: bigint,
) {
  return {
    address: locker,
    abi: lockerCcaAbi,
    eventName: "Registered" as const,
    args: { token },
    fromBlock,
    toBlock,
  };
}

/**
 * Reload path when the migrate receipt is gone: Locker `Registered(token, tokenId)`
 * logs filtered by token, chunked and bounded by the deploy/lookback block.
 * Never uses `tokenIdsOf` — that array can fail once spam registrations pile up.
 */
export async function fetchLockerRegisteredTokenIds(
  client: {
    getBlockNumber: () => Promise<bigint>;
    getContractEvents: (query: ReturnType<typeof lockerRegisteredLogsQuery>) => Promise<unknown>;
  },
  locker: Address,
  token: Address,
  fromBlock?: bigint,
  auctionStartBlock?: bigint,
  latestBlock?: bigint,
): Promise<bigint[]> {
  const toBlock = latestBlock ?? (await client.getBlockNumber());
  const lookback = ccaLogsFromBlock(undefined, toBlock, auctionStartBlock);
  const rangeStart = fromBlock === undefined ? lookback : fromBlock > lookback ? fromBlock : lookback;
  const ids: bigint[] = [];
  for (const chunk of ccaLogChunks(rangeStart, toBlock)) {
    const part = await client.getContractEvents(
      lockerRegisteredLogsQuery(locker, token, chunk.toBlock, chunk.fromBlock),
    );
    const rows = Array.isArray(part) ? part : [part];
    for (const row of rows) {
      const tokenId = registeredTokenIdFromLog(row);
      if (tokenId != null) ids.push(tokenId);
    }
  }
  return ids;
}

export function registeredTokenIdFromLog(row: unknown): bigint | undefined {
  if (!row || typeof row !== "object") return undefined;
  const args = "args" in row ? (row as { args?: { tokenId?: bigint | string | number } }).args : undefined;
  const raw = args?.tokenId;
  if (raw == null) return undefined;
  try {
    return BigInt(raw);
  } catch {
    return undefined;
  }
}

export function tokenIdFromRegisteredLogs(ids: readonly bigint[]): bigint | undefined {
  if (ids.length === 0) return undefined;
  return ids[ids.length - 1];
}

export function lockerProphetOfRead(locker: Address, token: Address) {
  return {
    address: locker,
    abi: lockerCcaAbi,
    functionName: "prophetOf" as const,
    args: [token] as const,
  };
}

export function findLockerTokenIdReads(positionManager: Address, startId: bigint, count = LOCKER_TOKEN_ID_SCAN) {
  const ids: bigint[] = [];
  for (let i = 0n; i < count && startId > i; i++) {
    ids.push(startId - i);
  }
  return ids.map((tokenId) => ({
    tokenId,
    ownerOf: {
      address: positionManager,
      abi: positionManagerAbi,
      functionName: "ownerOf" as const,
      args: [tokenId] as const,
    },
    poolInfo: {
      address: positionManager,
      abi: positionManagerAbi,
      functionName: "getPoolAndPositionInfo" as const,
      args: [tokenId] as const,
    },
  }));
}

export function matchLockerTokenId(input: {
  owner: Address;
  locker: Address;
  token: Address;
  hooks: Address;
  keyHooks: Address;
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
}): boolean {
  return (
    input.owner.toLowerCase() === input.locker.toLowerCase() &&
    input.currency0 === zeroAddress &&
    input.currency1.toLowerCase() === input.token.toLowerCase() &&
    input.keyHooks.toLowerCase() === input.hooks.toLowerCase() &&
    input.fee === POOL_FEE &&
    input.tickSpacing === POOL_TICK_SPACING
  );
}

export async function matchMintedTokenId(
  client: {
    readContract: (request: {
      address: Address;
      abi: readonly unknown[];
      functionName: string;
      args?: readonly unknown[];
    }) => Promise<unknown>;
  },
  ids: readonly bigint[],
  input: {
    positionManager: Address;
    locker: Address;
    token: Address;
    hooks: Address;
  },
): Promise<bigint | undefined> {
  for (const tokenId of ids) {
    try {
      const [key] = (await client.readContract({
        address: input.positionManager,
        abi: positionManagerAbi,
        functionName: "getPoolAndPositionInfo",
        args: [tokenId],
      })) as [
        { currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address },
        bigint,
      ];
      if (
        matchLockerTokenId({
          owner: input.locker,
          locker: input.locker,
          token: input.token,
          hooks: input.hooks,
          keyHooks: key.hooks,
          currency0: key.currency0,
          currency1: key.currency1,
          fee: Number(key.fee),
          tickSpacing: Number(key.tickSpacing),
        })
      ) {
        return tokenId;
      }
    } catch {
      // try next mint
    }
  }
  return ids.length === 1 ? ids[0] : undefined;
}

export async function findLockerTokenId(
  client: {
    readContract: (request: {
      address: Address;
      abi: readonly unknown[];
      functionName: string;
      args?: readonly unknown[];
    }) => Promise<unknown>;
    getBlockNumber?: () => Promise<bigint>;
    getContractEvents?: (query: {
      address: Address;
      eventName: string;
      fromBlock: bigint;
      toBlock: bigint;
    }) => Promise<unknown>;
  },
  input: {
    positionManager: Address;
    locker: Address;
    token: Address;
    hooks: Address;
    fromBlock?: bigint;
    auctionStartBlock?: bigint;
    latestBlock?: bigint;
  },
): Promise<bigint | undefined> {
  if (client.getContractEvents && client.getBlockNumber) {
    const minted = await fetchPositionManagerMintLogs(
      {
        getBlockNumber: client.getBlockNumber,
        getContractEvents: client.getContractEvents,
      },
      input.positionManager,
      input.locker,
      input.fromBlock,
      input.auctionStartBlock,
      input.latestBlock,
    );
    const ids = tokenIdsMintedToLocker(minted, input.locker, input.positionManager);
    const matched = await matchMintedTokenId(client, ids, input);
    if (matched != null) return matched;
  }
  if (client.getContractEvents && client.getBlockNumber) {
    const registered = await fetchLockerRegisteredTokenIds(
      {
        getBlockNumber: client.getBlockNumber,
        getContractEvents: client.getContractEvents,
      },
      input.locker,
      input.token,
      input.fromBlock,
      input.auctionStartBlock,
      input.latestBlock,
    );
    return tokenIdFromRegisteredLogs(registered);
  }
  return undefined;
}
