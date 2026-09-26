import { describe, expect, it } from "vitest";
import {
  MAX_MEMO_BYTES,
  MAX_PROPHECY_BYTES,
  MEMO_COPY,
  isMemoTooLong,
  isProphecyWithinLimit,
  memoBytesLeft,
  memoRemainingLabel,
  utf8ByteLength,
} from "./limits";

describe("UTF-8 byte limits from Launchpad.sol", () => {
  it("counts multibyte characters as more than one byte near the memo limit", () => {
    expect(MAX_MEMO_BYTES).toBe(140);
    expect(MAX_PROPHECY_BYTES).toBe(MAX_MEMO_BYTES);
    expect(utf8ByteLength("a")).toBe(1);
    expect(utf8ByteLength("한")).toBe(3);
    const near = "한".repeat(46);
    expect(utf8ByteLength(near)).toBe(138);
    expect(isMemoTooLong(near)).toBe(false);
    expect(memoBytesLeft(near)).toBe(2);
    expect(memoRemainingLabel(near)).toBe("2 left");
    expect(memoRemainingLabel(near)).not.toMatch(/byte/i);
    const over = "한".repeat(47);
    expect(utf8ByteLength(over)).toBe(141);
    expect(isMemoTooLong(over)).toBe(true);
    expect(isProphecyWithinLimit(over)).toBe(false);
    expect(isProphecyWithinLimit(near)).toBe(true);
    expect(MEMO_COPY.tooLong).toBe("Memo is too long. Shorten it to trade.");
  });
});
