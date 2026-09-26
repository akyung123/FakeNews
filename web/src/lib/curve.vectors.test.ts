import { describe, expect, test } from "bun:test";
import vectors from "../../../docs/curve-vectors.json";
import {
  CREATOR_BPS,
  CURVE_SUPPLY_WEI,
  FEE_BPS,
  LP_SUPPLY_WEI,
  PROTOCOL_BPS,
  TOTAL_SUPPLY_WEI,
  VIRTUAL_ETH_WEI,
  VIRTUAL_TOKEN_WEI,
  quoteBuyOn,
  quoteBuyWei,
  quoteSellWei,
  type CurveWei,
} from "./curve";

const asBig = (value: string) => BigInt(value);

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

describe("SPEC quote vectors", () => {
  for (const vector of vectors.vectors) {
    test(vector.name, () => {
      if (vector.kind === "buyOn") {
        const got = quoteBuyOn({
          vEth: asBig(vector.input.vEth),
          vToken: asBig(vector.input.vToken),
          remaining: asBig(vector.input.remaining),
          ethIn: asBig(vector.input.ethIn),
          feeBps: asBig(vector.input.feeBps),
        });
        expect(got.tokensOut).toBe(asBig(vector.expected.tokensOut));
        expect(got.ethNet).toBe(asBig(vector.expected.ethNet));
        expect(got.fee).toBe(asBig(vector.expected.fee));
        expect(got.ethInUsed).toBe(asBig(vector.expected.ethInUsed));
        return;
      }

      const state: CurveWei = {
        sold: asBig(vector.state.sold),
        realEth: asBig(vector.state.realEth),
      };

      if (vector.kind === "buy") {
        const got = quoteBuyWei(state, asBig(vector.input.ethIn));
        expect(got.tokensOut).toBe(asBig(vector.expected.tokensOut));
        expect(got.ethNet).toBe(asBig(vector.expected.ethNet));
        expect(got.fee).toBe(asBig(vector.expected.fee));
        expect(got.ethInUsed).toBe(asBig(vector.expected.ethInUsed));
        return;
      }

      const got = quoteSellWei(state, asBig(vector.input.tokensIn));
      expect(got.ethOut).toBe(asBig(vector.expected.ethOut));
      expect(got.fee).toBe(asBig(vector.expected.fee));
      expect(got.ethPayout).toBe(asBig(vector.expected.ethPayout));
    });
  }
});
