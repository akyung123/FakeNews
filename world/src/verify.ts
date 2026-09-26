import { checksumAddress, toHex, type Hex } from "viem";
import type { Config } from "./config.ts";
import { portalRejected } from "./errors.ts";
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
