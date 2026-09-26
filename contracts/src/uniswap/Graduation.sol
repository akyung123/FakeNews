// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {FullMath} from "v4-core/src/libraries/FullMath.sol";
import {LiquidityAmounts} from "v4-core/test/utils/LiquidityAmounts.sol";

/// Pool start price and full-range seed math for graduation.
/// V4 price is token1/token0 (tokens per ETH). The curve's P is the inverse
/// (ETH per token), so the helper uses vToken/vEth, never vEth/vToken.
library Graduation {
    uint24 internal constant POOL_FEE = 10_000;
    int24 internal constant TICK_SPACING = 200;
    uint256 internal constant PROPHET_SHARE = 24;
    uint256 internal constant SPLIT_DENOM = 100;
    /// 0.0068% = 68 parts per million.
    uint256 internal constant MAX_PRICE_GAP_PPM = 68;

    error ZeroReserves();
    error PriceOverflow();

    function tickLower() internal pure returns (int24) {
        return TickMath.minUsableTick(TICK_SPACING);
    }

    function tickUpper() internal pure returns (int24) {
        return TickMath.maxUsableTick(TICK_SPACING);
    }

    function poolKey(address token, IHooks hook) internal pure returns (PoolKey memory key) {
        key = PoolKey({
            currency0: CurrencyLibrary.ADDRESS_ZERO,
            currency1: Currency.wrap(token),
            fee: POOL_FEE,
            tickSpacing: TICK_SPACING,
            hooks: hook
        });
    }

    function sqrtPriceX96FromVirtualReserves(uint256 vEth, uint256 vToken) internal pure returns (uint160) {
        if (vEth == 0 || vToken == 0) revert ZeroReserves();
        uint256 ratioX192 = FullMath.mulDiv(vToken, uint256(1) << 192, vEth);
        uint256 root = sqrt(ratioX192);
        if (root > type(uint160).max) revert PriceOverflow();
        return uint160(root);
    }

    function fullRangeLiquidity(uint160 sqrtPriceX96, uint256 amount0, uint256 amount1)
        internal
        pure
        returns (uint128)
    {
        return LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96, TickMath.getSqrtPriceAtTick(tickLower()), TickMath.getSqrtPriceAtTick(tickUpper()), amount0, amount1
        );
    }

    /// Prophet 24, protocol the rest (including rounding dust), same ratio as the curve 30:95 split.
    function splitFees(uint256 amount) internal pure returns (uint256 prophetShare, uint256 protocolShare) {
        prophetShare = amount * PROPHET_SHARE / SPLIT_DENOM;
        protocolShare = amount - prophetShare;
    }

    /// |curve ETH-per-token − pool ETH-per-token| / curve, in parts per million.
    function priceGapPpm(uint256 vEth, uint256 vToken, uint160 sqrtPriceX96) internal pure returns (uint256) {
        uint256 curveQ128 = FullMath.mulDiv(vEth, uint256(1) << 128, vToken);
        uint256 sp2 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        uint256 poolQ128 = FullMath.mulDiv(uint256(1) << 128, uint256(1) << 192, sp2);
        uint256 gap = curveQ128 > poolQ128 ? curveQ128 - poolQ128 : poolQ128 - curveQ128;
        if (curveQ128 == 0) return type(uint256).max;
        return FullMath.mulDiv(gap, 1_000_000, curveQ128);
    }

    function sqrt(uint256 x) internal pure returns (uint256 z) {
        if (x == 0) return 0;
        uint256 xx = x;
        uint256 r = 1;
        if (xx >= 0x100000000000000000000000000000000) {
            xx >>= 128;
            r <<= 64;
        }
        if (xx >= 0x10000000000000000) {
            xx >>= 64;
            r <<= 32;
        }
        if (xx >= 0x100000000) {
            xx >>= 32;
            r <<= 16;
        }
        if (xx >= 0x10000) {
            xx >>= 16;
            r <<= 8;
        }
        if (xx >= 0x100) {
            xx >>= 8;
            r <<= 4;
        }
        if (xx >= 0x10) {
            xx >>= 4;
            r <<= 2;
        }
        if (xx >= 0x8) r <<= 1;
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1;
        uint256 r1 = x / r;
        return r < r1 ? r : r1;
    }
}
