import { describe, expect, test } from "bun:test";
import vectors from "./Curve.vectors.json";
import {
  CREATOR_BPS,
  CURVE_SUPPLY_WEI,
  FEE_BPS,
  LP_SUPPLY_WEI,
  PROTOCOL_BPS,
  TOTAL_SUPPLY_WEI,
  VIRTUAL_ETH_WEI,
  VIRTUAL_TOKEN_WEI,
  quoteBuyWei,
  quoteSellWei,
} from "./curve";

/**
 * Canonical file is backend M1 PR #8 `contracts/test/Curve.vectors.json`.
 * This test reads the byte-matching copy next to it. Do not edit contracts/.
 * Sell field `ethOut` in the fixture is the seller payout; `rawOut` is SPEC ethOut.
 */
const asBig = (value: string | number) => BigInt(value);

describe("SPEC constants", () => {
  test("match the shared vector file and DECISIONS #7", () => {
    expect(TOTAL_SUPPLY_WEI).toBe(asBig(vectors.constants.TOTAL_SUPPLY));
    expect(CURVE_SUPPLY_WEI).toBe(asBig(vectors.constants.CURVE_SUPPLY));
    expect(LP_SUPPLY_WEI).toBe(asBig(vectors.constants.LP_SUPPLY));
    expect(VIRTUAL_TOKEN_WEI).toBe(asBig(vectors.constants.VIRTUAL_TOKEN));
    expect(VIRTUAL_ETH_WEI).toBe(asBig(vectors.constants.VIRTUAL_ETH));
    expect(FEE_BPS).toBe(asBig(vectors.constants.FEE_BPS));
    expect(CREATOR_BPS).toBe(asBig(vectors.constants.CREATOR_BPS));
    expect(PROTOCOL_BPS).toBe(asBig(vectors.constants.PROTOCOL_BPS));
    expect(CREATOR_BPS + PROTOCOL_BPS).toBe(FEE_BPS);
    expect(CURVE_SUPPLY_WEI + LP_SUPPLY_WEI).toBe(TOTAL_SUPPLY_WEI);
  });
});

describe("canonical quote vectors (PR #8 / SPEC)", () => {
  const start = {
    sold: asBig(vectors.start.sold),
    realEth: asBig(vectors.start.realEth),
  };

  for (const vector of vectors.vectors) {
    test(vector.id, () => {
      if (vector.action === "buy") {
        const got = quoteBuyWei(start, asBig(vector.ethIn));
        expect(got.tokensOut).toBe(asBig(vector.tokensOut));
        expect(got.ethNet).toBe(asBig(vector.ethNet));
        expect(got.fee).toBe(asBig(vector.fee));
        expect(got.ethInUsed).toBe(asBig(vector.ethUsed));
        expect(got.ethInUsed + asBig(vector.refund)).toBe(asBig(vector.ethIn));
        expect(asBig(vector.creatorFee) + asBig(vector.protocolFee)).toBe(got.fee);
        if (vector.completes) {
          expect(got.tokensOut).toBe(CURVE_SUPPLY_WEI);
          expect(got.ethNet).toBe(asBig(vector.realEthAfter));
        }
        return;
      }

      const priorBuy = vectors.vectors.find((row) => row.id === "buy_0_001_at_start");
      if (!priorBuy) throw new Error("missing buy_0_001_at_start");
      const afterBuy = {
        sold: asBig(priorBuy.tokensOut),
        realEth: asBig(priorBuy.ethNet),
      };
      const got = quoteSellWei(afterBuy, asBig(vector.tokensIn));
      // Fixture ethOut is seller payout; rawOut is SPEC ethOut (before fee).
      expect(got.ethPayout).toBe(asBig(vector.ethOut));
      expect(got.ethOut).toBe(asBig(vector.rawOut));
      expect(got.fee).toBe(asBig(vector.fee));
    });
  }
});
