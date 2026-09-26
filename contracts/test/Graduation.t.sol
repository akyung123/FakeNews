// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";

import {ProphecyToken} from "../src/ProphecyToken.sol";
import {Graduation} from "../src/uniswap/Graduation.sol";
import {LaunchpadStack} from "./LaunchpadStack.sol";

contract GraduationTest is LaunchpadStack {
    function setUp() public {
        _deployStack();
    }

    function test_fullRangeTicksMatchSpacing200() public pure {
        assertEq(Graduation.tickLower(), TickMath.minUsableTick(200));
        assertEq(Graduation.tickUpper(), TickMath.maxUsableTick(200));
        assertEq(Graduation.tickLower(), -887200);
        assertEq(Graduation.tickUpper(), 887200);
        assertEq(Graduation.POOL_FEE, 10_000);
        assertEq(Graduation.TICK_SPACING, 200);
    }

    function test_poolKeyIsNativeEthAndToken() public {
        address token = address(new ProphecyToken("t.prophecy.eth", "T", address(this)));
        PoolKey memory key = Graduation.poolKey(token, IHooks(address(hook)));
        assertEq(Currency.unwrap(key.currency0), address(0));
        assertEq(Currency.unwrap(key.currency1), token);
        assertEq(key.fee, 10_000);
        assertEq(key.tickSpacing, 200);
        assertEq(address(key.hooks), address(hook));
    }

    function testFuzz_priceGapUnderLimit(uint256 vEth, uint256 vToken) public pure {
        vEth = bound(vEth, 1e13, 1e19);
        vToken = bound(vToken, 1e23, 1e28);
        uint160 sqrtP = Graduation.sqrtPriceX96FromVirtualReserves(vEth, vToken);
        uint256 gap = Graduation.priceGapPpm(vEth, vToken, sqrtP);
        assertLt(gap, Graduation.MAX_PRICE_GAP_PPM);
    }

    function test_zeroReservesRevert() public {
        vm.expectRevert(Graduation.ZeroReserves.selector);
        this.sqrtPrice(0, 1);
        vm.expectRevert(Graduation.ZeroReserves.selector);
        this.sqrtPrice(1, 0);
    }

    function sqrtPrice(uint256 vEth, uint256 vToken) external pure returns (uint160) {
        return Graduation.sqrtPriceX96FromVirtualReserves(vEth, vToken);
    }
}
