/** Sepolia Etherscan links. One network only (AGENTS rule 4). */
const ETHERSCAN = "https://sepolia.etherscan.io";

export function etherscanToken(address: string): string {
  return `${ETHERSCAN}/token/${address}`;
}

export function etherscanTx(hash: string): string {
  return `${ETHERSCAN}/tx/${hash}`;
}

/** 0x1234…abcd. The full value is always one Copy away. */
export function shortHex(value: string, head = 6, tail = 4): string {
  return value.length > head + tail + 1 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}

export function isTxHash(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}
