import { isAddress, type Address } from "viem";
import { malformed } from "./errors.ts";

export type ParsedVerifyRequest = {
  wallet: Address;
  chainId: bigint;
  launchpad: Address;
  idkitResponse: Record<string, unknown>;
};

export function parseVerifyRequest(body: unknown, expectedAction: string): ParsedVerifyRequest {
  if (!isObject(body)) {
    throw malformed("JSON object required");
  }

  const wallet = parseAddress(body.wallet, "wallet");
  const launchpad = parseAddress(body.launchpad, "launchpad");
  const chainId = parseChainId(body.chainId);
  const idkitResponse = extractIdkitResponse(body);

  if (typeof idkitResponse.protocol_version === "string") {
    if (idkitResponse.protocol_version !== "4.0" && idkitResponse.protocol_version !== "3.0") {
      throw malformed("protocol_version must be 4.0 or 3.0");
    }
  }

  if (!Array.isArray(idkitResponse.responses) || idkitResponse.responses.length === 0) {
    throw malformed("idkitResponse.responses must be a non-empty array");
  }

  if (typeof idkitResponse.session_id === "string" && idkitResponse.action === undefined) {
    throw malformed("session proofs are not accepted; uniqueness nullifier required");
  }

  if (typeof idkitResponse.action === "string" && idkitResponse.action !== expectedAction) {
    throw malformed("idkitResponse.action does not match WORLD_ACTION");
  }

  return { wallet, chainId, launchpad, idkitResponse };
}

export function parseUint256(value: string, field = "nullifier"): bigint {
  if (/^0x[0-9a-fA-F]+$/.test(value)) {
    return BigInt(value);
  }
  if (/^[0-9]+$/.test(value)) {
    return BigInt(value);
  }
  throw malformed(`${field} must be a hex or decimal uint256`);
}

function extractIdkitResponse(body: Record<string, unknown>): Record<string, unknown> {
  const candidate = body.idkitResponse ?? body.proof;
  if (candidate !== undefined) {
    if (!isObject(candidate)) {
      throw malformed("idkitResponse must be an object");
    }
    return candidate;
  }
  if (body.responses !== undefined || body.protocol_version !== undefined) {
    const { wallet: _wallet, chainId: _chainId, launchpad: _launchpad, ...rest } = body;
    return rest;
  }
  throw malformed("missing idkitResponse");
}

function parseAddress(value: unknown, field: string): Address {
  if (typeof value !== "string" || !isAddress(value)) {
    throw malformed(`${field} must be a 20-byte hex address`);
  }
  return value;
}

function parseChainId(value: unknown): bigint {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 1) {
      throw malformed("chainId must be a positive integer");
    }
    return BigInt(value);
  }
  if (typeof value === "string" && /^(?:0x[0-9a-fA-F]+|[1-9][0-9]*)$/.test(value)) {
    const chainId = BigInt(value);
    if (chainId < 1n) {
      throw malformed("chainId must be a positive integer");
    }
    return chainId;
  }
  throw malformed("chainId must be a positive integer");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
