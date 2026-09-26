import { describe, expect, it } from "vitest";
import {
  ago,
  eth,
  ethToWei,
  formatEth,
  formatEthAmount,
  formatPrice,
  formatPriceAmount,
  formatTokenAmount,
  pricePerToken,
  raisedFraction,
  tokens,
} from "./format";

const WAD = 10n ** 18n;

describe("formatEth", () => {
  it("rounds to 4 significant digits under 1 ETH", () => {
    expect(formatEth(999_999_999_999_999n)).toBe("0.001 ETH");
    expect(formatEth(40_000_000_000_000_001n)).toBe("0.04 ETH");
    expect(formatEth(12_345_678_000_000_000n)).toBe("0.01235 ETH");
    expect(formatEth(1n)).toBe("0.000000000000000001 ETH");
  });

  it("keeps 4 decimals from 1 ETH up and drops trailing zeros", () => {
    expect(formatEth(WAD)).toBe("1 ETH");
    expect(formatEth(1_234_567_890_000_000_000n)).toBe("1.2346 ETH");
    expect(formatEth(12n * WAD + 5n * 10n ** 17n)).toBe("12.5 ETH");
    expect(formatEth(999_960_000_000_000_000n)).toBe("1 ETH");
  });

  it("handles zero and negatives", () => {
    expect(formatEth(0n)).toBe("0 ETH");
    expect(formatEthAmount(-40_000_000_000_000_001n)).toBe("-0.04");
  });
});

describe("formatPriceAmount", () => {
  it("keeps 4 significant digits in ETH from 1e-6 ETH up", () => {
    expect(formatPriceAmount(ethToWei(5e-4))).toBe("0.0005 ETH");
    expect(formatPriceAmount(10n ** 12n)).toBe("0.000001 ETH");
    expect(formatPriceAmount(12_345_678_000_000n)).toBe("0.00001235 ETH");
  });

  it("reads in gwei under 1e-6 ETH (1 gwei = 1e-9 ETH)", () => {
    expect(formatPriceAmount(ethToWei(4e-8))).toBe("40 gwei");
    expect(formatPriceAmount(ethToWei(1.615e-7))).toBe("161.5 gwei");
    expect(formatPriceAmount(ethToWei(4e-11))).toBe("0.04 gwei");
    expect(formatPriceAmount(ethToWei(1.615e-10))).toBe("0.1615 gwei");
    expect(formatPriceAmount(40_000_000_001n)).toBe("40 gwei");
  });

  it("carries a rounded 1000 gwei into ETH", () => {
    expect(formatPriceAmount(999_999_999_999n)).toBe("0.000001 ETH");
  });

  it("floors tiny prices and keeps zero in ETH", () => {
    expect(formatPriceAmount(100_000n)).toBe("0.0001 gwei");
    expect(formatPriceAmount(99_999n)).toBe("<0.0001 gwei");
    expect(formatPriceAmount(1n)).toBe("<0.0001 gwei");
    expect(formatPriceAmount(0n)).toBe("0 ETH");
  });
});

describe("formatPrice", () => {
  it("is formatPriceAmount per whole token", () => {
    expect(formatPrice(40_000_000_001n)).toBe("40 gwei per token");
    expect(formatPrice(ethToWei(5e-4))).toBe("0.0005 ETH per token");
    expect(formatPrice(0n)).toBe("0 ETH per token");
    expect(pricePerToken(4e-8)).toBe(formatPrice(40_000_000_000n));
  });
});

describe("formatTokenAmount", () => {
  it("abbreviates with K, M and B", () => {
    expect(formatTokenAmount(1_234n * WAD)).toBe("1.23K");
    expect(formatTokenAmount(1_234_567n * WAD)).toBe("1.23M");
    expect(formatTokenAmount(500_000_000n * WAD)).toBe("500M");
    expect(formatTokenAmount(1_000_000_000n * WAD)).toBe("1B");
  });

  it("carries a rounded 1000 into the next suffix", () => {
    expect(formatTokenAmount(999_999n * WAD)).toBe("1M");
    expect(formatTokenAmount(999_999n * 10n ** 15n)).toBe("1K");
  });

  it("shows small amounts without float noise", () => {
    expect(formatTokenAmount(WAD)).toBe("1");
    expect(formatTokenAmount(12_345n * 10n ** 15n)).toBe("12.35");
    expect(formatTokenAmount(5n * 10n ** 17n)).toBe("0.5");
    expect(formatTokenAmount(0n)).toBe("0");
    expect(formatTokenAmount(1_500_000n, 6)).toBe("1.5");
  });
});

describe("float helpers share the bigint output", () => {
  it("eth and tokens match formatEth and formatTokenAmount", () => {
    expect(eth(0.01)).toBe("0.01 ETH");
    expect(eth(0.04)).toBe(formatEth(40_000_000_000_000_000n));
    expect(tokens(2_500_000)).toBe("2.5M");
    expect(ethToWei(Number.NaN)).toBe(0n);
    expect(ethToWei(-1)).toBe(0n);
  });
});

describe("raisedFraction", () => {
  const goal = 20_000_000_000_000_000n;
  it("is bigint exact and capped at 1", () => {
    expect(raisedFraction(goal, goal)).toBe(1);
    expect(raisedFraction(goal * 3n, goal)).toBe(1);
    expect(raisedFraction(goal / 2n, goal)).toBe(0.5);
    expect(raisedFraction(0n, goal)).toBe(0);
    expect(raisedFraction(1n, 0n)).toBe(0);
  });
});

describe("ago", () => {
  const now = 1_800_000_000_000;
  it("uses minutes, hours and days", () => {
    expect(ago(now - 30_000, now)).toBe("just now");
    expect(ago(now - 5 * 60_000, now)).toBe("5m ago");
    expect(ago(now - 3 * 3_600_000, now)).toBe("3h ago");
    expect(ago(now - 2 * 86_400_000, now)).toBe("2d ago");
  });

  it("is empty when the time is unknown", () => {
    expect(ago(undefined, now)).toBe("");
    expect(ago(0, now)).toBe("");
    expect(ago(Number.NaN, now)).toBe("");
  });
});
