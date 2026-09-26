/**
 * Permissionless locker.register(token, tokenId) after migrate.
 * Official PositionManager `_mint` does not call onERC721Received.
 * tokenId is the PositionManager ERC-721 Transfer(from=0, to=locker, tokenId)
 * on the migrate receipt (INTERFACE_CCA §7.12). Fallback: nextTokenId walk.
 */
import { parseEventLogs, zeroAddress, type Address, type Log } from "viem";
import { lockerCcaAbi, positionManagerAbi } from "./abi/launchpadCca";
import { POOL_FEE, POOL_TICK_SPACING } from "./config";
import { sendCcaWrite, type CcaWriteOptions, type CcaWriteRequest } from "./writes";
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

/** INTERFACE_CCA §7.12 — mint Transfer on the migrate receipt. */
export function tokenIdsMintedToLocker(logs: readonly unknown[], locker: Address): bigint[] {
  try {
    const parsed = parseEventLogs({
      abi: positionManagerTransferAbi,
      logs: logs as Log[],
      strict: false,
    });
    return parsed
      .filter(
        (row) =>
          row.eventName === "Transfer" &&
          row.args.from === zeroAddress &&
          Boolean(row.args.to) &&
          row.args.to!.toLowerCase() === locker.toLowerCase() &&
          row.args.tokenId != null,
      )
      .map((row) => BigInt(row.args.tokenId!));
  } catch {
    return [];
  }
}

export function tokenIdOfRead(locker: Address, token: Address) {
  return {
    address: locker,
    abi: lockerCcaAbi,
    functionName: "tokenIdOf" as const,
    args: [token] as const,
  };
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

export async function findLockerTokenId(
  client: {
    readContract: (request: {
      address: Address;
      abi: readonly unknown[];
      functionName: string;
      args?: readonly unknown[];
    }) => Promise<unknown>;
  },
  input: {
    positionManager: Address;
    locker: Address;
    token: Address;
    hooks: Address;
  },
): Promise<bigint | undefined> {
  const next = (await client.readContract({
    address: input.positionManager,
    abi: positionManagerAbi,
    functionName: "nextTokenId",
    args: [],
  })) as bigint;
  if (next <= 1n) return undefined;
  const last = next - 1n;
  for (const row of findLockerTokenIdReads(input.positionManager, last)) {
    try {
      const owner = (await client.readContract(row.ownerOf)) as Address;
      if (owner.toLowerCase() !== input.locker.toLowerCase()) continue;
      const [key] = (await client.readContract(row.poolInfo)) as [
        { currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address },
        bigint,
      ];
      if (
        matchLockerTokenId({
          owner,
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
        return row.tokenId;
      }
    } catch {
      // skip unminted or foreign ids
    }
  }
  return undefined;
}
