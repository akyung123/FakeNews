import { describe, expect, it } from "bun:test";
import { keccak256, encodeAbiParameters, zeroAddress } from "viem";
import {
  applyCurveComplete,
  applyGraduatedEvent,
  GRADUATED_BODY,
  GRADUATED_LINK,
  GRADUATED_TITLE,
  MOCK_HOOK,
  mockGraduationState,
  UNISWAP_SEPOLIA_CHAIN,
  uniswapGraduationHref,
  uniswapPoolUrl,
  v4PoolId,
} from "./graduation";

const TOKEN = "0xa555555555555555555555555555555555555555" as const;
const POOL_ID = v4PoolId({ token: TOKEN, hooks: MOCK_HOOK });

describe("graduation copy", () => {
  it("uses the designer-approved three lines and says token, not coin", () => {
    expect(GRADUATED_TITLE).toBe("Graduated to Uniswap V4");
    expect(GRADUATED_BODY).toBe("The curve is closed. Trading continues on Uniswap.");
    expect(GRADUATED_LINK).toBe("View pool on Uniswap");
    const joined = `${GRADUATED_TITLE} ${GRADUATED_BODY} ${GRADUATED_LINK}`;
    expect(joined.toLowerCase()).not.toContain("coin");
    expect(joined.toLowerCase()).not.toContain("profit");
    expect(joined.toLowerCase()).not.toContain("yield");
  });
});

describe("v4 pool id", () => {
  it("is keccak256 of the 5-word PoolKey (ETH, token, fee, tickSpacing, hooks)", () => {
    const encoded = encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint24" },
        { type: "int24" },
        { type: "address" },
      ],
      [zeroAddress, TOKEN, 10_000, 200, MOCK_HOOK],
    );
    expect(v4PoolId({ token: TOKEN, hooks: MOCK_HOOK })).toBe(keccak256(encoded));
    expect(POOL_ID).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe("uniswap href", () => {
  it("builds an exact Sepolia V4 pool deep link from poolId", () => {
    const href = uniswapPoolUrl(POOL_ID);
    expect(href).toBe(`https://app.uniswap.org/explore/pools/${UNISWAP_SEPOLIA_CHAIN}/${POOL_ID}`);
    expect(uniswapGraduationHref({ graduated: true, poolId: POOL_ID, token: TOKEN })).toBe(href);
  });

  it("falls back to the token on Uniswap Sepolia when poolId is missing", () => {
    expect(uniswapGraduationHref({ graduated: true, token: TOKEN })).toBe(
      `https://app.uniswap.org/explore/tokens/${UNISWAP_SEPOLIA_CHAIN}/${TOKEN}`,
    );
  });
});

describe("event flip", () => {
  it("starts closed=false and flips on a mocked Graduated log", () => {
    let state = mockGraduationState(TOKEN, false);
    expect(state.graduated).toBe(false);
    expect(state.poolId).toBeUndefined();

    state = applyCurveComplete(state, false);
    expect(state.graduated).toBe(false);

    state = applyGraduatedEvent(state, { token: TOKEN, poolId: POOL_ID, hooks: MOCK_HOOK });
    expect(state.graduated).toBe(true);
    expect(state.poolId).toBe(POOL_ID);
    expect(uniswapGraduationHref(state)).toContain(POOL_ID);
  });

  it("also flips from curve().complete", () => {
    const after = applyCurveComplete({ graduated: false, token: TOKEN }, true);
    expect(after.graduated).toBe(true);
  });
});
