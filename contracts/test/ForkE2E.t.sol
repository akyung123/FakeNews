// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {PoolDonateTest} from "v4-core/src/test/PoolDonateTest.sol";

import {Launchpad} from "../src/Launchpad.sol";
import {ProphecyToken} from "../src/ProphecyToken.sol";
import {Graduation} from "../src/uniswap/Graduation.sol";
import {HookMiner} from "../src/uniswap/HookMiner.sol";
import {ForkE2EBase, RejectEthProphet, SEPOLIA_POOL_MANAGER} from "./ForkE2EHelpers.sol";

/// Sepolia-fork fallback: curve buy/sell with 1% slippage, a real V4 swap
/// both ways through PoolManager (hook attached), and locker collect 24:76
/// plus the rejecting-prophet `withdrawAccrued` path.
///
/// Infra #30 owns deploy → registerProphet → launch → sell-out → graduation
/// on its own fork run. This file does not repeat that script; it deploys a
/// minimal stack on the fork (or binds json/env addresses) and checks the
/// trade / pool / fee paths the frontend would hit at 20:00 KST.
contract ForkE2ETest is ForkE2EBase {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    function setUp() public {
        if (!_maybeFork()) return;
        _resolveAndBind();
        if (bytes(launchpad.prophetOf(prophet)).length == 0) {
            _register(prophet, "ringo");
        }
        vm.deal(prophet, 10 ether);
        vm.deal(buyer, 10 ether);
    }

    modifier onFork() {
        if (!forked) vm.skip(true);
        _;
    }

    function test_buySell_onePercentSlippageAndApprove() public onFork {
        address token = _launchSlug("slip-ok");
        uint256 ethIn = 0.001 ether;
        (uint256 tokensOut,) = launchpad.quoteBuy(token, ethIn);
        uint256 minTokensOut = _minOut(tokensOut);
        assertGt(minTokensOut, 0);

        vm.prank(buyer);
        launchpad.buy{value: ethIn}(token, minTokensOut, "fork-buy");
        assertEq(ProphecyToken(token).balanceOf(buyer), tokensOut);

        uint256 tokensIn = tokensOut / 2;
        vm.startPrank(buyer);
        ProphecyToken(token).approve(address(launchpad), tokensIn);
        (uint256 ethOut,) = launchpad.quoteSell(token, tokensIn);
        uint256 minEthOut = _minOut(ethOut);
        assertGt(minEthOut, 0);
        uint256 before = buyer.balance;
        launchpad.sell(token, tokensIn, minEthOut, "fork-sell");
        vm.stopPrank();

        assertEq(buyer.balance, before + ethOut);
        assertEq(ProphecyToken(token).balanceOf(buyer), tokensOut - tokensIn);
    }

    function test_buySell_slippageReverts() public onFork {
        address token = _launchSlug("slip-revert");
        uint256 ethIn = 0.001 ether;
        (uint256 tokensOut,) = launchpad.quoteBuy(token, ethIn);
        vm.prank(buyer);
        vm.expectRevert(Launchpad.Slippage.selector);
        launchpad.buy{value: ethIn}(token, tokensOut + 1, "");

        vm.prank(buyer);
        launchpad.buy{value: ethIn}(token, _minOut(tokensOut), "");

        uint256 tokensIn = ProphecyToken(token).balanceOf(buyer) / 2;
        (uint256 ethOut,) = launchpad.quoteSell(token, tokensIn);
        vm.startPrank(buyer);
        ProphecyToken(token).approve(address(launchpad), tokensIn);
        vm.expectRevert(Launchpad.Slippage.selector);
        launchpad.sell(token, tokensIn, ethOut + 1, "");
        vm.stopPrank();
    }

    function test_v4PoolSwap_bothDirections() public onFork {
        address token = _graduateSlug("v4-swap");
        (,,,, bool complete) = launchpad.curve(token);
        assertTrue(complete);

        PoolKey memory key = Graduation.poolKey(token, IHooks(address(hook)));
        assertEq(address(key.hooks), address(hook));
        assertEq(hook.launchpad(), address(launchpad));
        (uint160 sqrtP,,,) = manager.getSlot0(key.toId());
        assertGt(uint256(sqrtP), 0);

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
        uint256 tokensBought = ProphecyToken(token).balanceOf(trader);
        assertGt(tokensBought, 0);

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

    function test_collect_split24_76Exact() public onFork {
        address token = _graduateSlug("fee-split");
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
        // Pool fee-growth can eat a couple of wei; the paid pair is still 24:76.
        assertLe(ethFee - (prophetEth + protocolEth), 2);
        assertLe(tokFee - (prophetTok + protocolTok), 2);
    }

    function test_collect_rejectingProphetThenWithdrawAccrued() public onFork {
        RejectEthProphet rejector = new RejectEthProphet();
        vm.deal(address(rejector), 1 ether);
        _register(address(rejector), "rejector");
        vm.prank(address(rejector));
        address token = launchpad.launch("reject-eth", "a prophecy sentence", 1_800_000_000, 0);
        _sellOut(token);

        PoolKey memory key = Graduation.poolKey(token, IHooks(address(hook)));
        PoolDonateTest donor = new PoolDonateTest(manager);
        uint256 ethFee = 100;
        vm.deal(address(this), ethFee);
        donor.donate{value: ethFee}(key, ethFee, 0, "");

        uint256 protocolBefore = protocol.balance;
        locker.collect(token);
        assertGt(protocol.balance, protocolBefore);
        assertEq(address(rejector).balance, 1 ether);
        uint256 accrued = locker.accruedEth(address(rejector));
        assertGt(accrued, 0);
        assertEq(locker.totalAccruedEth(), accrued);

        (uint256 expP,) = Graduation.splitFees(accrued + (protocol.balance - protocolBefore));
        assertEq(accrued, expP);

        rejector.setAccept(true);
        uint256 before = address(rejector).balance;
        rejector.withdraw(locker);
        assertEq(address(rejector).balance, before + accrued);
        assertEq(locker.accruedEth(address(rejector)), 0);
        assertEq(locker.totalAccruedEth(), 0);
    }

    function test_forkUsesRealSepoliaPoolManager() public onFork {
        assertEq(address(manager), SEPOLIA_POOL_MANAGER);
        assertTrue(address(manager).code.length > 0);
        assertEq(address(launchpad.poolManager()), address(manager));
        assertEq(address(launchpad.hook()), address(hook));
        assertEq(address(launchpad.locker()), address(locker));
        assertEq(uint160(address(hook)) & HookMiner.FLAG_MASK, HookMiner.prophecyFlags());
    }

    function _assertSplit(uint256 prophetShare, uint256 protocolShare) internal pure {
        (uint256 expP, uint256 expR) = Graduation.splitFees(prophetShare + protocolShare);
        assertEq(prophetShare, expP);
        assertEq(protocolShare, expR);
        assertEq(prophetShare + protocolShare, expP + expR);
    }
}
