/**
 * Launchpad `MAX_MEMO` is an internal constant, not a view.
 * Hardcoded here from INTERFACE / DECISIONS #15.
 * Prophecy uses the same 140 UTF-8 bytes (`BadProphecy`: 1..140).
 * Solidity `bytes(string).length` is UTF-8 byte length, not JS characters.
 */
export const MAX_MEMO_BYTES = 140;
export const MAX_PROPHECY_BYTES = MAX_MEMO_BYTES;

export const MEMO_COPY = {
  tooLong: "Memo is too long. Shorten it to trade.",
} as const;

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function memoBytesLeft(value: string, max = MAX_MEMO_BYTES): number {
  return max - utf8ByteLength(value);
}

export function isMemoTooLong(value: string, max = MAX_MEMO_BYTES): boolean {
  return utf8ByteLength(value) > max;
}

export function memoRemainingLabel(value: string, max = MAX_MEMO_BYTES): string {
  const left = Math.max(0, memoBytesLeft(value, max));
  return `${left} left`;
}

export function isProphecyWithinLimit(value: string, max = MAX_PROPHECY_BYTES): boolean {
  const n = utf8ByteLength(value);
  return n >= 1 && n <= max;
}
