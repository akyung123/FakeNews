import { checksumAddress, toHex, type Address, type Hex } from "viem";
import type { Config } from "./config.ts";
import { contextMismatch, portalRejected } from "./errors.ts";
import { parseUint256, parseVerifyRequest } from "./parse.ts";
import type { PortalClient, PortalSuccess } from "./portal.ts";
import { signRegisterPayload } from "./sign.ts";

export type VerifySuccess = {
  nullifier: Hex;
  serverSig: Hex;
};

export async function verifyAndSign(
  config: Config,
  body: unknown,
  portal: PortalClient,
): Promise<VerifySuccess> {
  const request = parseVerifyRequest(body, config.action);
  assertPinnedContext(config, request.chainId, request.launchpad);
  const portalResult = await portal.verify(request.idkitResponse);
  const nullifier = extractNullifier(portalResult);
  const serverSig = await signRegisterPayload(config.signerKey, {
    chainId: request.chainId,
    launchpad: checksumAddress(request.launchpad),
    wallet: checksumAddress(request.wallet),
    nullifier,
  });

  return {
    nullifier: toHex(nullifier, { size: 32 }),
    serverSig,
  };
}

function assertPinnedContext(config: Config, chainId: bigint, launchpad: Address): void {
  if (config.chainId !== undefined && config.chainId !== chainId) {
    throw contextMismatch("chainId does not match WORLD_CHAIN_ID");
  }
  if (config.launchpad !== undefined && !sameAddress(config.launchpad, launchpad)) {
    throw contextMismatch("launchpad does not match WORLD_LAUNCHPAD_ADDRESS");
  }
}

function sameAddress(left: Address, right: Address): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function extractNullifier(result: PortalSuccess): bigint {
  if (typeof result.nullifier === "string" && result.nullifier.length > 0) {
    return parseUint256(result.nullifier);
  }

  for (const item of result.results ?? []) {
    if (item.success === false) {
      continue;
    }
    if (typeof item.nullifier === "string" && item.nullifier.length > 0) {
      return parseUint256(item.nullifier);
    }
  }

  throw portalRejected("Portal v4 verify succeeded without a uniqueness nullifier", result);
}
