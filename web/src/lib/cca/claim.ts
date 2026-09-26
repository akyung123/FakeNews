/**
 * Claim tokens after the auction claim block. The bid must already be exited.
 * When the goal was not reached the auction reverts `NotGraduated`.
 * Verified: IContinuousClearingAuction.claimTokens / claimTokensBatch (v2.1.0).
 */
import type { Address } from "viem";
import { ccaAbi } from "./abi/cca";
import { sendCcaWrite, type CcaWriteOptions, type CcaWriteRequest } from "./writes";
import type { Hex } from "../world";

export function claimTokensWrite(auction: Address, bidId: bigint): CcaWriteRequest {
  return {
    address: auction,
    abi: ccaAbi,
    functionName: "claimTokens",
    args: [bidId],
  };
}

export function claimTokensBatchWrite(auction: Address, owner: Address, bidIds: readonly bigint[]): CcaWriteRequest {
  return {
    address: auction,
    abi: ccaAbi,
    functionName: "claimTokensBatch",
    args: [owner, bidIds],
  };
}

export async function claimTokens(
  auction: Address,
  bidId: bigint,
  options: CcaWriteOptions = {},
): Promise<Hex> {
  return sendCcaWrite(claimTokensWrite(auction, bidId), "claimTokens", options);
}

export async function claimTokensBatch(
  auction: Address,
  owner: Address,
  bidIds: readonly bigint[],
  options: CcaWriteOptions = {},
): Promise<Hex> {
  return sendCcaWrite(claimTokensBatchWrite(auction, owner, bidIds), "claimTokensBatch", options);
}
