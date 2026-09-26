/**
 * Selling on the Universal Router needs two approvals first (INTERFACE_CCA §7.10):
 *   1. token.approve(Permit2)                    — ERC20 allowance to Permit2
 *   2. permit2.approve(token, router, amount, exp) — Permit2 allowance to the router
 * then 3. the sale. Both allowances are read from the chain so a step that is
 * already done is skipped, and read again after each approval receipt.
 */
import type { Address } from "viem";
import { getPublicClient } from "../rpc";
import { PERMIT2, UNIVERSAL_ROUTER, erc20ApproveAbi, permit2Abi } from "./swap";

export type SellApprovals = {
  /** ERC20 allowance from the owner to Permit2. */
  erc20: bigint;
  /** Permit2 allowance from the owner to the router for this token. */
  permit2Amount: bigint;
  /** Unix seconds; 0 means never set. */
  permit2Expiration: number;
};

export type SellStep = 1 | 2 | 3;
export const SELL_STEPS = 3;

export type ApprovalRead = (request: {
  address: Address;
  abi: readonly unknown[];
  functionName: string;
  args: readonly unknown[];
}) => Promise<unknown>;

export async function readSellApprovals(
  owner: Address,
  token: Address,
  read: ApprovalRead = (request) => getPublicClient().readContract(request as never),
  router: Address = UNIVERSAL_ROUTER,
): Promise<SellApprovals> {
  const [erc20, permit] = await Promise.all([
    read({ address: token, abi: erc20ApproveAbi, functionName: "allowance", args: [owner, PERMIT2] }),
    read({ address: PERMIT2, abi: permit2Abi, functionName: "allowance", args: [owner, token, router] }),
  ]);
  const row = Array.isArray(permit) ? permit : [];
  return {
    erc20: typeof erc20 === "bigint" ? erc20 : 0n,
    permit2Amount: typeof row[0] === "bigint" ? row[0] : 0n,
    permit2Expiration: Number(row[1] ?? 0),
  };
}

/** The first step still needed to sell `amountIn`. 3 means both approvals are in place. */
export function sellStep(approvals: SellApprovals, amountIn: bigint, nowSec = Math.floor(Date.now() / 1000)): SellStep {
  if (approvals.erc20 < amountIn) return 1;
  if (approvals.permit2Amount < amountIn || approvals.permit2Expiration <= nowSec) return 2;
  return 3;
}
