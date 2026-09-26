import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { lockerCcaAbi } from "./abi/launchpadCca";
import { FLOOR_PRICE_Q96, Q96, TICK_SPACING_Q96 } from "./config";

const CCA_LIB_HEAD = "9c6b163da093ea67d1788b43897bb3572e3fbc6d";
const LOCAL_CCA_LIB = resolve(import.meta.dirname, "../../../../contracts/src/cca/CcaLib.sol");

function readCcaLib(): string {
  if (existsSync(LOCAL_CCA_LIB)) return readFileSync(LOCAL_CCA_LIB, "utf8");
  return execFileSync("git", ["show", `${CCA_LIB_HEAD}:contracts/src/cca/CcaLib.sol`], {
    encoding: "utf8",
    cwd: resolve(import.meta.dirname, "../../../.."),
  });
}

describe("CcaLib.sol floor / tick parity (#42 9c6b163)", () => {
  it("mirrors FLOOR_PRICE_Q96 and AUCTION_TICK_SPACING_Q96 from CcaLib.sol", () => {
    const src = readCcaLib();
    expect(src).toContain("uint256 internal constant AUCTION_TICK_SPACING_Q96 = (_RAW_FLOOR_PRICE_Q96 + 99) / 100");
    expect(src).toContain("uint256 internal constant FLOOR_PRICE_Q96 = AUCTION_TICK_SPACING_Q96 * 100");

    const required = 10n ** 16n * 2n;
    const auctionSupply = 500_000_000n * 10n ** 18n;
    const raw = (required * Q96 + auctionSupply - 1n) / auctionSupply;
    const tick = (raw + 99n) / 100n;
    const floor = tick * 100n;

    expect(TICK_SPACING_Q96).toBe(tick);
    expect(FLOOR_PRICE_Q96).toBe(floor);
    expect(TICK_SPACING_Q96).toBe(31_691_265_005_705_736n);
    expect(FLOOR_PRICE_Q96).toBe(3_169_126_500_570_573_600n);
    expect(FLOOR_PRICE_Q96 % TICK_SPACING_Q96).toBe(0n);
  });
});

const LOCAL_LOCKER = resolve(import.meta.dirname, "../../../../contracts/src/uniswap/LiquidityLocker.sol");

function readLocker(): string {
  if (existsSync(LOCAL_LOCKER) && readFileSync(LOCAL_LOCKER, "utf8").includes("function collect(address token, uint256 tokenId)")) {
    return readFileSync(LOCAL_LOCKER, "utf8");
  }
  return execFileSync("git", ["show", `${CCA_LIB_HEAD}:contracts/src/uniswap/LiquidityLocker.sol`], {
    encoding: "utf8",
    cwd: resolve(import.meta.dirname, "../../../.."),
  });
}

describe("Locker ABI parity (#42 9c6b163)", () => {
  it("copies Collected(token indexed, tokenId indexed, …) from LiquidityLocker.sol", () => {
    const src = readLocker();
    expect(src).toMatch(/function collect\(address token, uint256 tokenId\)/);
    expect(src).toMatch(/function isRegistered\(address token, uint256 tokenId\)/);
    expect(src).toMatch(/function tokenIdsOf\(address token\)/);
    expect(src).not.toMatch(/function tokenIdOf\(/);
    expect(src).toMatch(
      /event Collected\(\s*address indexed token,\s*uint256 indexed tokenId,\s*uint256 prophetAmount0,\s*uint256 protocolAmount0,\s*uint256 prophetAmount1,\s*uint256 protocolAmount1\s*\)/,
    );
    const collected = lockerCcaAbi.find((item) => item.type === "event" && item.name === "Collected");
    if (!collected || collected.type !== "event") throw new Error("missing Collected");
    expect(collected.inputs[0]).toMatchObject({ name: "token", type: "address", indexed: true });
    expect(collected.inputs[1]).toMatchObject({ name: "tokenId", type: "uint256", indexed: true });
  });
});
