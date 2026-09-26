import { describe, expect, it, vi } from "vitest";
import { encodeEventTopics, zeroAddress } from "viem";
import { CCA_SEPOLIA } from "./addresses";
import { CCA_LOG_CHUNK_BLOCKS } from "./logs";
import {
  fetchPositionManagerMintLogs,
  positionManagerMintLogsQuery,
  positionManagerTransferAbi,
  tokenIdFromMigrateReceipt,
  tokenIdsMintedToLocker,
} from "./register";

const LOCKER = "0x3333333333333333333333333333333333333333" as const;
const OTHER = "0x4444444444444444444444444444444444444444" as const;
const PM = CCA_SEPOLIA.positionManager;
const OTHER_NFT = "0x5555555555555555555555555555555555555555" as const;

function mintLog(tokenId: bigint, to = LOCKER, address = PM) {
  const topics = encodeEventTopics({
    abi: positionManagerTransferAbi,
    eventName: "Transfer",
    args: { from: zeroAddress, to, tokenId },
  });
  return { address, topics, data: "0x" as const };
}

function transferLog(from: typeof zeroAddress | typeof LOCKER, to: typeof LOCKER, tokenId: bigint) {
  const topics = encodeEventTopics({
    abi: positionManagerTransferAbi,
    eventName: "Transfer",
    args: { from, to, tokenId },
  });
  return { address: PM, topics, data: "0x" as const };
}

describe("tokenId from migrate receipt", () => {
  it("reads Transfer(from=0x0, to=locker, tokenId) on PositionManager", () => {
    const receipt = { status: "success", logs: [mintLog(7n)] };
    expect(tokenIdFromMigrateReceipt(receipt, LOCKER, PM)).toBe(7n);
    expect(tokenIdsMintedToLocker(receipt.logs, LOCKER, PM)).toEqual([7n]);
  });

  it("ignores Transfer that is not a mint (from != 0)", () => {
    const receipt = { logs: [transferLog(LOCKER, OTHER, 7n)] };
    expect(tokenIdFromMigrateReceipt(receipt, LOCKER, PM)).toBeUndefined();
  });

  it("ignores a mint to a different address", () => {
    const receipt = { logs: [mintLog(7n, OTHER)] };
    expect(tokenIdFromMigrateReceipt(receipt, LOCKER, PM)).toBeUndefined();
  });

  it("ignores an ERC-721 Transfer from another contract", () => {
    const receipt = { logs: [mintLog(9n, LOCKER, OTHER_NFT), mintLog(11n)] };
    expect(tokenIdFromMigrateReceipt(receipt, LOCKER, PM)).toBe(11n);
    expect(tokenIdsMintedToLocker(receipt.logs, LOCKER, PM)).toEqual([11n]);
  });

  it("uses the last mint on a receipt with more than one locker mint", () => {
    const receipt = { logs: [mintLog(3n), mintLog(8n)] };
    expect(tokenIdFromMigrateReceipt(receipt, LOCKER, PM)).toBe(8n);
    expect(tokenIdsMintedToLocker(receipt.logs, LOCKER, PM)).toEqual([3n, 8n]);
  });

  it("returns undefined when the receipt has no logs", () => {
    expect(tokenIdFromMigrateReceipt({}, LOCKER, PM)).toBeUndefined();
    expect(tokenIdFromMigrateReceipt({ logs: [] }, LOCKER, PM)).toBeUndefined();
  });
});

describe("PositionManager mint log query (reload path)", () => {
  it("filters from=0x0 and to=locker on the PositionManager", () => {
    const query = positionManagerMintLogsQuery(PM, LOCKER, 90_000n, 40_000n);
    expect(query.address).toBe(PM);
    expect(query.eventName).toBe("Transfer");
    expect(query.args).toEqual({ from: zeroAddress, to: LOCKER });
    expect(query.fromBlock).toBe(40_000n);
    expect(query.toBlock).toBe(90_000n);
  });

  it("chunks the lookback with the lib 50_000-block rule", async () => {
    const getContractEvents = vi.fn(async (query: { fromBlock: bigint; toBlock: bigint }) => [
      mintLog(query.toBlock === 90_000n ? 8n : 1n),
    ]);
    const logs = await fetchPositionManagerMintLogs(
      {
        getBlockNumber: async () => 90_000n,
        getContractEvents,
      },
      PM,
      LOCKER,
    );
    expect(getContractEvents).toHaveBeenCalledTimes(2);
    expect(getContractEvents.mock.calls[0]![0]).toMatchObject({
      address: PM,
      fromBlock: 40_000n,
      toBlock: 40_000n + CCA_LOG_CHUNK_BLOCKS - 1n,
    });
    expect(tokenIdsMintedToLocker(logs, LOCKER, PM)).toEqual([1n, 8n]);
  });

  it("still applies lookback when fromBlock is passed below it", async () => {
    const getContractEvents = vi.fn(async () => []);
    await fetchPositionManagerMintLogs(
      {
        getBlockNumber: async () => 90_000n,
        getContractEvents,
      },
      PM,
      LOCKER,
      10_000n,
    );
    expect(getContractEvents.mock.calls[0]![0].fromBlock).toBe(40_000n);
  });
});
