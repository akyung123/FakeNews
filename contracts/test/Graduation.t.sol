// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {PoolIdLibrary} from "v4-core/src/types/PoolId.sol";

import {Launchpad} from "../src/Launchpad.sol";
import {ProphecyToken} from "../src/ProphecyToken.sol";
import {ProphecyHook} from "../src/uniswap/ProphecyHook.sol";
import {HookMiner} from "../src/uniswap/HookMiner.sol";
import {Graduation} from "../src/uniswap/Graduation.sol";
import {LiquidityLocker} from "../src/uniswap/LiquidityLocker.sol";
import {LaunchpadStack} from "./LaunchpadStack.sol";

contract GraduationTest is LaunchpadStack {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    address internal prophet = address(0xA11CE);
    address internal protocol = address(0xFEE);

    receive() external payable {}

    function setUp() public {
        _deployStack(protocol, address(0x51C));
        vm.deal(prophet, 10 ether);
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

    function test_specGraduationReservesGapUnderLimit() public {
        vm.prank(prophet);
        address token = launchpad.launch("lingo-2028", "", 0, 0);
        vm.prank(prophet);
        launchpad.buy{value: 1 ether}(token, 0, "");

        (uint256 vEth, uint256 vToken, uint256 realEth, uint256 sold, bool complete) = launchpad.curve(token);
        assertTrue(complete);
        assertEq(sold, launchpad.CURVE_SUPPLY());
        assertEq(vToken, launchpad.VIRTUAL_TOKEN() - launchpad.CURVE_SUPPLY());
        assertGt(realEth, 0);

        uint160 sqrtP = Graduation.sqrtPriceX96FromVirtualReserves(vEth, vToken);
        uint256 gap = Graduation.priceGapPpm(vEth, vToken, sqrtP);
        assertLt(gap, Graduation.MAX_PRICE_GAP_PPM);
    }

    function test_seedFullRangeAtVirtualReservePrice() public {
        vm.prank(prophet);
        address token = launchpad.launch("lingo-2028", "", 0, 0);
        vm.prank(prophet);
        launchpad.buy{value: 1 ether}(token, 0, "");
        (uint256 vEth, uint256 vToken,,, bool complete) = launchpad.curve(token);
        assertTrue(complete);

        PoolKey memory key = Graduation.poolKey(token, IHooks(address(hook)));
        (uint160 stored,,,) = manager.getSlot0(key.toId());
        uint160 expected = Graduation.sqrtPriceX96FromVirtualReserves(vEth, vToken);
        assertEq(stored, expected);
        assertLt(Graduation.priceGapPpm(vEth, vToken, stored), Graduation.MAX_PRICE_GAP_PPM);

        (uint128 liquidity,,) = manager.getPositionInfo(
            key.toId(), address(locker), Graduation.tickLower(), Graduation.tickUpper(), bytes32(0)
        );
        assertGt(liquidity, 0);
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
