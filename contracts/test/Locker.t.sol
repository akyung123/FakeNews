// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {PoolDonateTest} from "v4-core/src/test/PoolDonateTest.sol";

import {ProphecyToken} from "../src/ProphecyToken.sol";
import {ProphecyHook} from "../src/uniswap/ProphecyHook.sol";
import {HookMiner} from "../src/uniswap/HookMiner.sol";
import {Graduation} from "../src/uniswap/Graduation.sol";
import {LiquidityLocker} from "../src/uniswap/LiquidityLocker.sol";

contract LockerTest is Test {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    IPoolManager internal manager;
    ProphecyHook internal hook;
    LiquidityLocker internal locker;
    PoolDonateTest internal donor;
    ProphecyToken internal token;
    PoolKey internal key;

    address internal prophet = address(0xA11CE);
    address internal protocol = address(0xFEE);

    uint256 internal constant SEED_ETH = 0.02 ether;
    uint256 internal constant SEED_TOKEN = 206_900_000e18;

    receive() external payable {}

    function setUp() public {
        manager = new PoolManager(address(this));
        token = new ProphecyToken("lingo-2028.prophecy.eth", "LINGO-2028", address(this));

        bytes memory ctorArgs = abi.encode(manager, address(this));
        (, bytes32 salt) =
            HookMiner.find(address(this), HookMiner.prophecyFlags(), type(ProphecyHook).creationCode, ctorArgs);
        hook = new ProphecyHook{salt: salt}(manager, address(this));
        locker = new LiquidityLocker(manager, address(this), IHooks(address(hook)));
        donor = new PoolDonateTest(manager);

        key = Graduation.poolKey(address(token), IHooks(address(hook)));
        Graduation.initializePool(manager, key, 3 * 7_058_378_514_689_194, 279_900_000e18);

        token.approve(address(locker), SEED_TOKEN);
        locker.lock{value: SEED_ETH}(address(token), prophet, protocol, key, SEED_TOKEN);
    }

    function test_splitFeesExactAndDust() public pure {
        (uint256 p100, uint256 r100) = Graduation.splitFees(100);
        assertEq(p100, 24);
        assertEq(r100, 76);

        (uint256 p1, uint256 r1) = Graduation.splitFees(1);
        assertEq(p1, 0);
        assertEq(r1, 1);

        (uint256 p3, uint256 r3) = Graduation.splitFees(3);
        assertEq(p3, 0);
        assertEq(r3, 3);

        (uint256 p5, uint256 r5) = Graduation.splitFees(5);
        assertEq(p5, 1);
        assertEq(r5, 4);

        (uint256 p99, uint256 r99) = Graduation.splitFees(99);
        assertEq(p99, 23);
        assertEq(r99, 76);
        assertEq(p99 + r99, 99);

        (uint256 p0, uint256 r0) = Graduation.splitFees(0);
        assertEq(p0, 0);
        assertEq(r0, 0);
    }

    function test_lockSeedsFullRangeAndHasNoWithdraw() public {
        (uint128 liquidity,,) = manager.getPositionInfo(
            key.toId(), address(locker), Graduation.tickLower(), Graduation.tickUpper(), bytes32(0)
        );
        assertGt(liquidity, 0);

        (bool okWithdraw,) = address(locker).call(abi.encodeWithSignature("withdraw(address)", address(token)));
        assertFalse(okWithdraw);
        (bool okDecrease,) = address(locker).call(
            abi.encodeWithSignature("decreaseLiquidity(address,uint128)", address(token), uint128(1))
        );
        assertFalse(okDecrease);
        (bool okBurn,) = address(locker).call(abi.encodeWithSignature("burn(address)", address(token)));
        assertFalse(okBurn);
    }

    function test_lockRevertsForNonLaunchpad() public {
        ProphecyToken other = new ProphecyToken("other.prophecy.eth", "OTHER", address(this));
        PoolKey memory otherKey = Graduation.poolKey(address(other), IHooks(address(hook)));
        Graduation.initializePool(manager, otherKey, 1 ether, 1_000_000e18);
        address stranger = address(0xB0B);
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        vm.expectRevert(LiquidityLocker.NotLaunchpad.selector);
        locker.lock{value: 1 ether}(address(other), prophet, protocol, otherKey, 0);
    }

    function test_collectSplitsDonate24_76IncludingDust() public {
        uint256 ethFee = 101;
        uint256 tokFee = 7;
        vm.deal(address(this), ethFee);
        token.approve(address(donor), tokFee);
        donor.donate{value: ethFee}(key, ethFee, tokFee, "");

        uint128 liquidityBefore = _liquidity();
        locker.collect(address(token));
        assertEq(_liquidity(), liquidityBefore, "principal must stay locked");

        _assertSplit(prophet.balance, protocol.balance);
        _assertSplit(token.balanceOf(prophet), token.balanceOf(protocol));
        assertGt(prophet.balance + protocol.balance, 0);
        assertGt(token.balanceOf(prophet) + token.balanceOf(protocol), 0);
        // Pool fee-growth rounding can eat a few wei; the paid-out pair still sums to what was collected.
        assertLe(ethFee - (prophet.balance + protocol.balance), 2);
        assertLe(tokFee - (token.balanceOf(prophet) + token.balanceOf(protocol)), 2);
    }

    function test_collectExactHundred() public {
        uint256 ethFee = 100;
        uint256 tokFee = 100;
        vm.deal(address(this), ethFee);
        token.approve(address(donor), tokFee);
        donor.donate{value: ethFee}(key, ethFee, tokFee, "");
        locker.collect(address(token));
        _assertSplit(prophet.balance, protocol.balance);
        _assertSplit(token.balanceOf(prophet), token.balanceOf(protocol));
        assertGt(prophet.balance + protocol.balance, 90);
        assertGt(token.balanceOf(prophet) + token.balanceOf(protocol), 90);
    }

    function test_collectUnknownReverts() public {
        vm.expectRevert(LiquidityLocker.UnknownLock.selector);
        locker.collect(address(0xDEAD));
    }

    function test_secondLockReverts() public {
        token.approve(address(locker), 1);
        vm.expectRevert(LiquidityLocker.AlreadyLocked.selector);
        locker.lock{value: 1}(address(token), prophet, protocol, key, 1);
    }

    function test_collectPaysProtocolWhenProphetRejectsEth() public {
        RejectingProphet rejector = new RejectingProphet();
        ProphecyToken tok = new ProphecyToken("reject.prophecy.eth", "REJECT", address(this));
        PoolKey memory rejectKey = Graduation.poolKey(address(tok), IHooks(address(hook)));
        Graduation.initializePool(manager, rejectKey, 3 * 7_058_378_514_689_194, 279_900_000e18);
        tok.approve(address(locker), SEED_TOKEN);
        vm.deal(address(this), SEED_ETH);
        locker.lock{value: SEED_ETH}(address(tok), address(rejector), protocol, rejectKey, SEED_TOKEN);

        uint256 ethFee = 100;
        vm.deal(address(this), ethFee);
        donor.donate{value: ethFee}(rejectKey, ethFee, 0, "");

        uint256 protocolBefore = protocol.balance;
        locker.collect(address(tok));
        assertGt(protocol.balance, protocolBefore);
        assertEq(address(rejector).balance, 0);
        uint256 accrued = locker.accruedEth(address(rejector));
        assertGt(accrued, 0);

        rejector.setAccept(true);
        uint256 before = address(rejector).balance;
        rejector.withdraw(locker);
        assertEq(address(rejector).balance, before + accrued);
        assertEq(locker.accruedEth(address(rejector)), 0);
    }

    function test_withdrawAccruedRevertsWhenEmpty() public {
        vm.expectRevert(LiquidityLocker.NothingAccrued.selector);
        locker.withdrawAccrued();
    }

    function _liquidity() internal view returns (uint128 liquidity) {
        (liquidity,,) = manager.getPositionInfo(
            key.toId(), address(locker), Graduation.tickLower(), Graduation.tickUpper(), bytes32(0)
        );
    }

    function _assertSplit(uint256 prophetShare, uint256 protocolShare) internal pure {
        (uint256 expP, uint256 expR) = Graduation.splitFees(prophetShare + protocolShare);
        assertEq(prophetShare, expP);
        assertEq(protocolShare, expR);
        assertEq(prophetShare + protocolShare, expP + expR);
    }
}

contract RejectingProphet {
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
