/**
 * Anyone may `checkpoint()` after endBlock so the UI can read a current
 * clearing price (INTERFACE_CCA §7 “Ended, not finalized” / §8 step 3).
 */
import type { Address } from "viem";
import { ccaAbi } from "./abi/cca";
import { sendCcaWrite, type CcaWriteOptions, type CcaWriteRequest } from "./writes";
import type { Hex } from "../world";

export function checkpointWrite(auction: Address): CcaWriteRequest {
  return {
    address: auction,
    abi: ccaAbi,
    functionName: "checkpoint",
    args: [],
  };
}

export async function checkpoint(auction: Address, options: CcaWriteOptions = {}): Promise<Hex> {
  return sendCcaWrite(checkpointWrite(auction), "checkpoint", options);
}
