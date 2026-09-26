/**
 * Read-only Sepolia ENSv2 lookup for demo scenes 1 and 2.
 *
 *   bun ens-lookup.ts lingo-2028.ringo.prophecy.eth
 *
 * RPC: SEPOLIA_RPC_URL, or a public Sepolia endpoint (no API key).
 * Resolver address: docs/ENSV2.md section 0 (UniversalResolverV2).
 * Text keys: INTERFACE section 1 — prophecy, deadline, avatar, description.
 */
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { normalize } from "viem/ens";

const UNIVERSAL_RESOLVER_V2 = "0x5d25C1D6aCBb71B7a28AA7899618a3412a8303e3" as const;
const PUBLIC_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const TEXT_KEYS = ["prophecy", "deadline", "avatar", "description"] as const;

const nameArg = process.argv[2];
if (!nameArg) {
  console.error("usage: bun ens-lookup.ts <name>");
  console.error("example: bun ens-lookup.ts lingo-2028.ringo.prophecy.eth");
  process.exit(1);
}

const rpc = process.env.SEPOLIA_RPC_URL?.trim() || PUBLIC_RPC;
const name = normalize(nameArg);
const client = createPublicClient({
  chain: sepolia,
  transport: http(rpc),
});

const [blockNumber, address, resolver, ...texts] = await Promise.all([
  client.getBlockNumber(),
  client.getEnsAddress({ name, universalResolverAddress: UNIVERSAL_RESOLVER_V2 }),
  client.getEnsResolver({ name, universalResolverAddress: UNIVERSAL_RESOLVER_V2 }),
  ...TEXT_KEYS.map((key) =>
    client.getEnsText({ name, key, universalResolverAddress: UNIVERSAL_RESOLVER_V2 }).catch(() => null),
  ),
]);

const records: Record<string, string | null> = {};
TEXT_KEYS.forEach((key, i) => {
  records[key] = texts[i] ?? null;
});

console.log(
  JSON.stringify(
    {
      name,
      chainId: sepolia.id,
      blockNumber: blockNumber.toString(),
      rpc: process.env.SEPOLIA_RPC_URL?.trim() ? "SEPOLIA_RPC_URL" : PUBLIC_RPC,
      universalResolver: UNIVERSAL_RESOLVER_V2,
      address,
      resolver,
      text: records,
    },
    null,
    2,
  ),
);
