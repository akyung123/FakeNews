/**
 * Open the market: LBPStrategy.migrate(initializer).
 * Anyone can call it after the auction ends and the goal is reached.
 * The initializer is the CCA auction (ILBPInitializer).
 * Verified: ILBPStrategy.migrate at liquidity-launcher 1c5904912aefceaceb89c24528cd5e25d0b61597.
 *
 * A caught failure emits MigrationFailed + FundsRecovered and does not revert.
 */
import { parseEventLogs, type Address, type Log } from "viem";
import { CCA_SEPOLIA } from "./addresses";
import { lbpStrategyAbi } from "./abi/lbpStrategy";
import { sendCcaWrite, sendCcaWriteResult, type CcaReceipt, type CcaWriteOptions, type CcaWriteRequest } from "./writes";
import type { Hex } from "../world";

export type MigrateOutcome = "migrated" | "failed" | "unknown";

export function openMarketWrite(
  initializer: Address,
  strategy = CCA_SEPOLIA.lbpStrategy,
): CcaWriteRequest {
  return {
    address: strategy,
    abi: lbpStrategyAbi,
    functionName: "migrate",
    args: [initializer],
  };
}

export function migrateOutcomeFromReceipt(receipt: CcaReceipt | { logs?: readonly unknown[] }): MigrateOutcome {
  try {
    const logs = parseEventLogs({
      abi: lbpStrategyAbi,
      logs: (receipt.logs ?? []) as Log[],
      strict: false,
    });
    if (logs.some((row) => row.eventName === "Migrated")) return "migrated";
    if (logs.some((row) => row.eventName === "MigrationFailed" || row.eventName === "FundsRecovered")) {
      return "failed";
    }
  } catch {
    // receipt may omit logs (tests / sparse RPC)
  }
  return "unknown";
}

export async function openMarket(
  initializer: Address,
  options: CcaWriteOptions = {},
  strategy = CCA_SEPOLIA.lbpStrategy,
): Promise<Hex> {
  return sendCcaWrite(openMarketWrite(initializer, strategy), "migrate", options);
}

export async function openMarketResult(
  initializer: Address,
  options: CcaWriteOptions = {},
  strategy = CCA_SEPOLIA.lbpStrategy,
): Promise<{ hash: Hex; outcome: MigrateOutcome; receipt: CcaReceipt }> {
  const { hash, receipt } = await sendCcaWriteResult(
    openMarketWrite(initializer, strategy),
    "migrate",
    options,
  );
  return { hash, outcome: migrateOutcomeFromReceipt(receipt), receipt };
}
