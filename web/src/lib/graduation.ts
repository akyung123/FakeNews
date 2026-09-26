/**
 * Graduation reads and the Uniswap V4 pool link.
 *
 * On-chain flag is Launchpad.curve(token).complete (no getState).
 * Graduated carries poolId (V4 PoolId = keccak256 of the 5-word PoolKey).
 * PoolKey: currency0 = native ETH (address(0)), currency1 = token,
 * fee 10000, tickSpacing 200, hooks = ProphecyHook.
 */
import { encodeAbiParameters, keccak256, zeroAddress, type Address, type Hex } from "viem";

export const GRADUATED_TITLE = "Graduated to Uniswap V4";
export const GRADUATED_BODY = "The curve is closed. Trading continues on Uniswap.";
export const GRADUATED_LINK = "View pool on Uniswap";

export const V4_POOL_FEE = 10_000;
export const V4_TICK_SPACING = 200;

/**
 * Uniswap app chain slug for Sepolia.
 *
 * Verified 2026-09-26 against a live Sepolia V4 pool (not guessed):
 * `https://app.uniswap.org/explore/pools/ethereum_sepolia/0x6c71acabd92a7d8ed27cdfb6fba8cf0bab74dc9f1a93b55c15537528e1e7443f`
 * opened as "LLL/ETH · Sepolia · v4" via LiquidityService/GetPool.
 * Source: Uniswap/interface `SEPOLIA_CHAIN_INFO` (`urlParam` + `supportsV4` +
 * `backendSupported`) and route `/explore/pools/:chainName/:poolAddress`.
 */
export const UNISWAP_SEPOLIA_CHAIN = "ethereum_sepolia";

export type GraduationState = {
  graduated: boolean;
  poolId?: Hex;
  token?: Address;
  hooks?: Address;
};

export type GraduatedEventArgs = {
  token: Address;
  poolId: Hex;
  fee?: number;
  tickSpacing?: number;
  hooks?: Address;
};

/** Stand-in hook so mock tokens still build a V4 pool URL. Live uses launchpad.hook(). */
export const MOCK_HOOK = "0xcccccccccccccccccccccccccccccccccccccccc" as Address;

export function v4PoolId(input: {
  token: Address;
  hooks: Address;
  fee?: number;
  tickSpacing?: number;
}): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint24" },
        { type: "int24" },
        { type: "address" },
      ],
      [
        zeroAddress,
        input.token,
        input.fee ?? V4_POOL_FEE,
        input.tickSpacing ?? V4_TICK_SPACING,
        input.hooks,
      ],
    ),
  );
}

export function uniswapPoolUrl(poolId: Hex): string {
  return `https://app.uniswap.org/explore/pools/${UNISWAP_SEPOLIA_CHAIN}/${poolId}`;
}

export function uniswapTokenUrl(token: Address): string {
  return `https://app.uniswap.org/explore/tokens/${UNISWAP_SEPOLIA_CHAIN}/${token}`;
}

export function uniswapGraduationHref(state: GraduationState): string {
  if (state.poolId) return uniswapPoolUrl(state.poolId);
  if (state.token) return uniswapTokenUrl(state.token);
  return `https://app.uniswap.org/explore/pools/${UNISWAP_SEPOLIA_CHAIN}`;
}

export function poolIdFromKey(token?: Address, hooks?: Address): Hex | undefined {
  if (!token || !hooks || hooks === zeroAddress) return undefined;
  return v4PoolId({ token, hooks });
}

/** Apply a Graduated log so the trade panel can flip without a refetch. */
export function applyGraduatedEvent(prev: GraduationState, ev: GraduatedEventArgs): GraduationState {
  return {
    ...prev,
    graduated: true,
    token: ev.token,
    poolId: ev.poolId,
    hooks: ev.hooks ?? prev.hooks,
  };
}

export function applyCurveComplete(prev: GraduationState, complete: boolean): GraduationState {
  if (!complete) return prev;
  return { ...prev, graduated: true };
}

export function mockGraduationState(token: Address, graduated: boolean): GraduationState {
  return {
    graduated,
    token,
    hooks: MOCK_HOOK,
    poolId: graduated ? v4PoolId({ token, hooks: MOCK_HOOK }) : undefined,
  };
}
