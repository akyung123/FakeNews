// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {PoolDonateTest} from "v4-core/src/test/PoolDonateTest.sol";

import {Launchpad} from "../src/Launchpad.sol";
import {ProphecyToken} from "../src/ProphecyToken.sol";
import {Graduation} from "../src/uniswap/Graduation.sol";
import {LiquidityLocker} from "../src/uniswap/LiquidityLocker.sol";
import {LaunchpadStack} from "./LaunchpadStack.sol";

contract ToggleWallet {
    bool public accept;

    function setAccept(bool v) external {
        accept = v;
    }

    receive() external payable {
        if (!accept) revert();
    }

    function withdraw(LiquidityLocker loc) external {
        loc.withdrawAccrued();
    }
}

contract LaunchpadGraduationTest is LaunchpadStack {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    receive() external payable {}

    function setUp() public {
        _deployStack();
        vm.deal(prophet, 10 ether);
        vm.deal(buyer, 10 ether);
    }

    function test_fullCurveBuyGraduatesPoolAtCurvePrice() public {
        address token = _registerLaunchAndGraduate();
        (uint256 vEth, uint256 vToken, uint256 realEth, uint256 sold, bool complete) = launchpad.curve(token);
        assertTrue(complete);
        assertEq(sold, launchpad.CURVE_SUPPLY());
        assertEq(realEth, 0.02 ether);

        PoolKey memory key = Graduation.poolKey(token, IHooks(address(hook)));
        (uint160 sqrtP,,,) = manager.getSlot0(key.toId());
        uint160 expected = Graduation.sqrtPriceX96FromVirtualReserves(vEth, vToken);
        assertEq(sqrtP, expected);
        assertLt(Graduation.priceGapPpm(vEth, vToken, sqrtP), Graduation.MAX_PRICE_GAP_PPM);
        address dead = address(0x000000000000000000000000000000000000dEaD);
        uint256 burned = ProphecyToken(token).balanceOf(dead);
        assertEq(ProphecyToken(token).balanceOf(address(launchpad)), 0);
        assertEq(
            ProphecyToken(token).balanceOf(buyer) + ProphecyToken(token).balanceOf(address(manager)) + burned,
            ProphecyToken(token).totalSupply()
        );
    }

    function test_liquidityLockedNoWithdraw() public {
        address token = _registerLaunchAndGraduate();
        PoolKey memory key = Graduation.poolKey(token, IHooks(address(hook)));
        (uint128 liquidity,,) = manager.getPositionInfo(
            key.toId(), address(locker), Graduation.tickLower(), Graduation.tickUpper(), bytes32(0)
        );
        assertGt(liquidity, 0);

        (bool okWithdraw,) = address(locker).call(abi.encodeWithSignature("withdraw(address)", token));
        assertFalse(okWithdraw);
        (bool okDecrease,) = address(locker).call(
            abi.encodeWithSignature("decreaseLiquidity(address,uint128)", token, uint128(1))
        );
        assertFalse(okDecrease);
        (bool okBurn,) = address(locker).call(abi.encodeWithSignature("burn(address)", token));
        assertFalse(okBurn);
    }

    function test_curveBuySellRevertAfterGraduation() public {
        address token = _registerLaunchAndGraduate();
        vm.prank(buyer);
        vm.expectRevert(Launchpad.CurveComplete.selector);
        launchpad.buy{value: 0.001 ether}(token, 0, "");

        uint256 bal = ProphecyToken(token).balanceOf(buyer);
        vm.startPrank(buyer);
        ProphecyToken(token).approve(address(launchpad), bal);
        vm.expectRevert(Launchpad.CurveComplete.selector);
        launchpad.sell(token, bal, 0, "");
        vm.stopPrank();
    }

    function test_swapsWorkAfterGraduation() public {
        address token = _registerLaunchAndGraduate();
        PoolKey memory key = Graduation.poolKey(token, IHooks(address(hook)));
        PoolSwapTest swapper = new PoolSwapTest(manager);
        address trader = address(0x5A0);
        vm.deal(trader, 1 ether);

        vm.prank(trader);
        swapper.swap{value: 0.001 ether}(
            key,
            IPoolManager.SwapParams({
                zeroForOne: true,
                amountSpecified: -int256(0.001 ether),
                sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
        assertGt(ProphecyToken(token).balanceOf(trader), 0);

        uint256 ethBefore = buyer.balance;
        vm.startPrank(buyer);
        ProphecyToken(token).approve(address(swapper), 1_000e18);
        swapper.swap(
            key,
            IPoolManager.SwapParams({
                zeroForOne: false,
                amountSpecified: -int256(1_000e18),
                sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
        vm.stopPrank();
        assertGt(buyer.balance, ethBefore);
    }

    function test_collectSplitsProphet24Protocol76() public {
        address token = _registerLaunchAndGraduate();
        PoolKey memory key = Graduation.poolKey(token, IHooks(address(hook)));
        PoolDonateTest donor = new PoolDonateTest(manager);
        uint256 ethFee = 100;
        uint256 tokFee = 100;
        vm.prank(buyer);
        ProphecyToken(token).transfer(address(this), tokFee);
        vm.deal(address(this), ethFee);
        ProphecyToken(token).approve(address(donor), tokFee);
        donor.donate{value: ethFee}(key, ethFee, tokFee, "");

        uint256 prophetEthBefore = prophet.balance;
        uint256 protocolEthBefore = protocol.balance;
        uint256 prophetTokBefore = ProphecyToken(token).balanceOf(prophet);
        uint256 protocolTokBefore = ProphecyToken(token).balanceOf(protocol);
        locker.collect(token);

        uint256 prophetEth = prophet.balance - prophetEthBefore;
        uint256 protocolEth = protocol.balance - protocolEthBefore;
        uint256 prophetTok = ProphecyToken(token).balanceOf(prophet) - prophetTokBefore;
        uint256 protocolTok = ProphecyToken(token).balanceOf(protocol) - protocolTokBefore;
        _assertSplit(prophetEth, protocolEth);
        _assertSplit(prophetTok, protocolTok);
        assertGt(prophetEth + protocolEth, 0);
        assertGt(prophetTok + protocolTok, 0);
    }

    function test_rejectingProphetAccruesAndProtocolIsPaid() public {
        ToggleWallet prophetC = new ToggleWallet();
        vm.deal(address(prophetC), 1 ether);
        address token = _registerAndLaunchAs(address(prophetC), "rejector", "reject-eth");
        _sellOut(token);

        PoolKey memory key = Graduation.poolKey(token, IHooks(address(hook)));
        PoolDonateTest donor = new PoolDonateTest(manager);
        uint256 ethFee = 100;
        vm.deal(address(this), ethFee);
        donor.donate{value: ethFee}(key, ethFee, 0, "");

        uint256 protocolBefore = protocol.balance;
        locker.collect(token);
        assertGt(protocol.balance, protocolBefore);
        assertEq(address(prophetC).balance, 1 ether);
        uint256 accrued = locker.accruedEth(address(prophetC));
        assertGt(accrued, 0);

        // A later graduation must not sweep the accrued ETH to the next seed refund.
        address other = _registerAndLaunchAs(prophet, "ringo", "second-grad");
        _sellOut(other);
        assertEq(locker.accruedEth(address(prophetC)), accrued);
        assertEq(locker.totalAccruedEth(), accrued);

        PoolKey memory otherKey = Graduation.poolKey(other, IHooks(address(hook)));
        (uint128 liquidityBefore,,) = manager.getPositionInfo(
            otherKey.toId(), address(locker), Graduation.tickLower(), Graduation.tickUpper(), bytes32(0)
        );

        prophetC.setAccept(true);
        uint256 before = address(prophetC).balance;
        prophetC.withdraw(locker);
        assertEq(address(prophetC).balance, before + accrued);
        assertEq(locker.accruedEth(address(prophetC)), 0);
        assertEq(locker.totalAccruedEth(), 0);

        (uint128 liquidityAfter,,) = manager.getPositionInfo(
            otherKey.toId(), address(locker), Graduation.tickLower(), Graduation.tickUpper(), bytes32(0)
        );
        assertEq(liquidityAfter, liquidityBefore);
    }

    function test_onlyLaunchpadCanInitializeViaHook() public {
        address token = address(new ProphecyToken("other.prophecy.eth", "OTHER", address(this)));
        PoolKey memory key = Graduation.poolKey(token, IHooks(address(hook)));
        uint160 sqrtP = Graduation.sqrtPriceX96FromVirtualReserves(1 ether, 1_000_000e18);
        vm.prank(buyer);
        vm.expectRevert();
        manager.initialize(key, sqrtP);
        vm.expectRevert();
        manager.initialize(key, sqrtP);
    }

    function test_receiveRefundPath() public {
        _registerLaunchAndGraduate();
        uint256 fees = launchpad.protocolFees() + launchpad.creatorFeeOf(prophet);
        assertGe(address(launchpad).balance, fees);

        vm.deal(address(locker), 1);
        vm.prank(address(locker));
        (bool okLocker,) = address(launchpad).call{value: 1}("");
        assertTrue(okLocker);

        vm.deal(address(manager), 1);
        vm.prank(address(manager));
        (bool okPm,) = address(launchpad).call{value: 1}("");
        assertTrue(okPm);

        vm.deal(buyer, 1);
        vm.prank(buyer);
        (bool okStranger,) = address(launchpad).call{value: 1}("");
        assertFalse(okStranger);
    }

    function test_graduatedEventHasPoolKey() public {
        address token = _registerAndLaunch();
        vm.recordLogs();
        _sellOut(token);
        PoolKey memory key = Graduation.poolKey(token, IHooks(address(hook)));
        bytes32 poolId = PoolId.unwrap(key.toId());
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool found;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics.length >= 3 && logs[i].topics[0] == Launchpad.Graduated.selector) {
                assertEq(address(uint160(uint256(logs[i].topics[1]))), token);
                assertEq(logs[i].topics[2], poolId);
                found = true;
            }
        }
        assertTrue(found, "Graduated not emitted");
    }

    function test_overshootRefundsThenGraduates() public {
        address token = _registerAndLaunch();
        uint256 before = buyer.balance;
        _sellOut(token);
        assertLt(before - buyer.balance, 1 ether);
        (,,,, bool complete) = launchpad.curve(token);
        assertTrue(complete);
        PoolKey memory key = Graduation.poolKey(token, IHooks(address(hook)));
        (uint160 sqrtP,,,) = manager.getSlot0(key.toId());
        assertGt(uint256(sqrtP), 0);
        assertEq(ProphecyToken(token).balanceOf(buyer), launchpad.CURVE_SUPPLY());
    }

    function test_setUniswapSecondCallReverts() public {
        vm.expectRevert(Launchpad.UniswapAlreadySet.selector);
        launchpad.setUniswap(manager, address(hook), address(locker));
    }

    function test_setUniswapNonDeployerReverts() public {
        Launchpad pad = _newLaunchpad(protocol, signer);
        vm.prank(buyer);
        vm.expectRevert(Launchpad.NotDeployer.selector);
        pad.setUniswap(manager, address(hook), address(locker));
    }

    function test_graduationBeforeSetUniswapReverts() public {
        Launchpad pad = _newLaunchpad(protocol, signer);
        _registerProphetOn(pad, prophet, "ringo");
        address token = _launchOn(pad, prophet, "no-uniswap");
        vm.expectRevert(Launchpad.UniswapNotSet.selector);
        _sellOutOn(pad, buyer, token);
    }

    function test_setUniswapRejectsZero() public {
        Launchpad pad = _newLaunchpad(protocol, signer);
        vm.expectRevert(Launchpad.ZeroAddress.selector);
        pad.setUniswap(IPoolManager(address(0)), address(hook), address(locker));
        vm.expectRevert(Launchpad.ZeroAddress.selector);
        pad.setUniswap(manager, address(0), address(locker));
        vm.expectRevert(Launchpad.ZeroAddress.selector);
        pad.setUniswap(manager, address(hook), address(0));
    }

    function _assertSplit(uint256 prophetShare, uint256 protocolShare) internal pure {
        (uint256 expP, uint256 expR) = Graduation.splitFees(prophetShare + protocolShare);
        assertEq(prophetShare, expP);
        assertEq(protocolShare, expR);
    }
}
