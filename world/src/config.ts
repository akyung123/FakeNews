import { checksumAddress, isAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export type WorldEnvironment = "production" | "staging";

export type Config = {
  appId: string;
  action: string;
  rpId: string;
  rpSigningKey: Hex;
  signerKey: Hex;
  environment: WorldEnvironment;
  portalBaseUrl: string;
  port: number;
  chainId?: bigint;
  launchpad?: Address;
};

const DEFAULT_PORT = 8787;
const DEFAULT_PORTAL_PRODUCTION = "https://developer.world.org";
const DEFAULT_PORTAL_STAGING = "https://staging-developer.worldcoin.org";

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const appId = required(env, "WORLD_APP_ID");
  const action = required(env, "WORLD_ACTION");
  const rpId = required(env, "WORLD_RP_ID");
  const rpSigningKey = parsePrivateKey(required(env, "WORLD_RP_SIGNING_KEY"), "WORLD_RP_SIGNING_KEY");
  const signerKey = parsePrivateKey(required(env, "WORLD_SIGNER_KEY"), "WORLD_SIGNER_KEY");
  const environment = parseEnvironment(env.WORLD_ENVIRONMENT);
  const portalBaseUrl = (env.WORLD_PORTAL_URL ?? defaultPortalUrl(environment)).replace(/\/$/, "");
  const port = parsePort(env.PORT);
  const chainId = parseOptionalChainId(env.WORLD_CHAIN_ID);
  const launchpad = parseOptionalAddress(env.WORLD_LAUNCHPAD_ADDRESS, "WORLD_LAUNCHPAD_ADDRESS");

  if (!appId.startsWith("app_")) {
    throw new Error("WORLD_APP_ID must start with app_");
  }
  if (!rpId.startsWith("rp_") && !rpId.startsWith("app_")) {
    throw new Error("WORLD_RP_ID must start with rp_ (app_ is accepted for Portal compatibility)");
  }

  return {
    appId,
    action,
    rpId,
    rpSigningKey,
    signerKey,
    environment,
    portalBaseUrl,
    port,
    chainId,
    launchpad,
  };
}

export function signerAddress(config: Config): Address {
  return checksumAddress(privateKeyToAccount(config.signerKey).address);
}

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function parsePrivateKey(value: string, name: string): Hex {
  const hex = (value.startsWith("0x") ? value : `0x${value}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(`${name} must be a 32-byte hex key`);
  }
  return hex;
}

function parseEnvironment(value: string | undefined): WorldEnvironment {
  if (value === undefined || value === "") {
    return "production";
  }
  if (value === "production" || value === "staging") {
    return value;
  }
  throw new Error("WORLD_ENVIRONMENT must be production or staging");
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value === "") {
    return DEFAULT_PORT;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer from 1 to 65535");
  }
  return port;
}

function defaultPortalUrl(environment: WorldEnvironment): string {
  return environment === "staging" ? DEFAULT_PORTAL_STAGING : DEFAULT_PORTAL_PRODUCTION;
}

function parseOptionalChainId(value: string | undefined): bigint | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (/^(?:0x[0-9a-fA-F]+|[1-9][0-9]*)$/.test(trimmed)) {
    const chainId = BigInt(trimmed);
    if (chainId >= 1n) {
      return chainId;
    }
  }
  throw new Error("WORLD_CHAIN_ID must be a positive integer");
}

function parseOptionalAddress(value: string | undefined, name: string): Address | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (!isAddress(trimmed)) {
    throw new Error(`${name} must be a 20-byte hex address`);
  }
  return trimmed;
}
