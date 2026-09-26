// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";

import {ProphecyToken} from "../src/ProphecyToken.sol";
import {Graduation} from "../src/uniswap/Graduation.sol";
import {LiquidityLocker} from "../src/uniswap/LiquidityLocker.sol";
import {MockPositionManager} from "./mocks/MockCca.sol";

contract LockerTest is Test {
    IPoolManager internal manager;
    LiquidityLocker internal locker;
    MockPositionManager internal posm;
    ProphecyToken internal token;
    address internal hook = address(uint160(0x400C));

    address internal prophet = address(0xA11CE);
    address internal protocol = address(0xFEE);

    receive() external payable {}

    function setUp() public {
        manager = new PoolManager(address(this));
        token = new ProphecyToken("lingo-2028.prophecy.eth", "LINGO-2028", address(this));
        locker = new LiquidityLocker(manager, address(this), IHooks(hook));
        posm = new MockPositionManager();
        locker.setPositionManager(address(posm));
        locker.prepare(address(token), prophet, protocol);
        posm.mintTo(address(locker), address(token), hook);
    }

    function test_splitFeesExactAndDust() public pure {
        (uint256 p100, uint256 r100) = Graduation.splitFees(100);
        assertEq(p100, 24);
        assertEq(r100, 76);

        (uint256 p1, uint256 r1) = Graduation.splitFees(1);
        assertEq(p1, 0);
        assertEq(r1, 1);

        (uint256 p5, uint256 r5) = Graduation.splitFees(5);
        assertEq(p5, 1);
        assertEq(r5, 4);

        (uint256 p99, uint256 r99) = Graduation.splitFees(99);
        assertEq(p99, 23);
        assertEq(r99, 76);
        assertEq(p99 + r99, 99);
    }

    function test_holdsNftAndHasNoWithdraw() public {
        assertGt(locker.tokenIdOf(address(token)), 0);
        (bool okWithdraw,) = address(locker).call(abi.encodeWithSignature("withdraw(address)", address(token)));
        assertFalse(okWithdraw);
        (bool okDecrease,) = address(locker).call(
            abi.encodeWithSignature("decreaseLiquidity(address,uint128)", address(token), uint128(1))
        );
        assertFalse(okDecrease);
        (bool okBurn,) = address(locker).call(abi.encodeWithSignature("burn(address)", address(token)));
        assertFalse(okBurn);
        (bool okTransfer,) =
            address(locker).call(abi.encodeWithSignature("transferFrom(address,address,uint256)", address(locker), prophet, uint256(1)));
        assertFalse(okTransfer);
    }

    function test_prepareRevertsForNonLaunchpad() public {
        ProphecyToken other = new ProphecyToken("other.prophecy.eth", "OTHER", address(this));
        address stranger = address(0xB0B);
        vm.prank(stranger);
        vm.expectRevert(LiquidityLocker.NotLaunchpad.selector);
        locker.prepare(address(other), prophet, protocol);
    }

    function test_collectSplitsDonate24_76IncludingDust() public {
        uint256 ethFee = 101;
        uint256 tokFee = 7;
        token.transfer(address(posm), tokFee);
        vm.deal(address(posm), ethFee);
        posm.setFees(ethFee, address(token), tokFee);

        locker.collect(address(token));
        _assertSplit(prophet.balance, protocol.balance);
        _assertSplit(token.balanceOf(prophet), token.balanceOf(protocol));
        assertEq(prophet.balance + protocol.balance, ethFee);
        assertEq(token.balanceOf(prophet) + token.balanceOf(protocol), tokFee);
    }

    function test_collectExactHundred() public {
        uint256 ethFee = 100;
        uint256 tokFee = 100;
        token.transfer(address(posm), tokFee);
        vm.deal(address(posm), ethFee);
        posm.setFees(ethFee, address(token), tokFee);
        locker.collect(address(token));
        _assertSplit(prophet.balance, protocol.balance);
        _assertSplit(token.balanceOf(prophet), token.balanceOf(protocol));
    }

    function test_collectUnknownReverts() public {
        vm.expectRevert(LiquidityLocker.UnknownLock.selector);
        locker.collect(address(0xDEAD));
    }

    function test_secondPrepareReverts() public {
        vm.expectRevert(LiquidityLocker.AlreadyPrepared.selector);
        locker.prepare(address(token), prophet, protocol);
    }

    function test_collectPaysProtocolWhenProphetRejectsEth() public {
        RejectingProphet rejector = new RejectingProphet();
        ProphecyToken tok = new ProphecyToken("reject.prophecy.eth", "REJECT", address(this));
        locker.prepare(address(tok), address(rejector), protocol);
        posm.mintTo(address(locker), address(tok), hook);

        uint256 ethFee = 100;
        vm.deal(address(posm), ethFee);
        posm.setFees(ethFee, address(0), 0);

        uint256 protocolBefore = protocol.balance;
        locker.collect(address(tok));
        assertGt(protocol.balance, protocolBefore);
        assertEq(address(rejector).balance, 0);
        uint256 accrued = locker.accruedEth(address(rejector));
        assertGt(accrued, 0);
        assertEq(locker.totalAccruedEth(), accrued);

        rejector.setAccept(true);
        uint256 before = address(rejector).balance;
        rejector.withdraw(locker);
        assertEq(address(rejector).balance, before + accrued);
        assertEq(locker.accruedEth(address(rejector)), 0);
        assertEq(locker.totalAccruedEth(), 0);
    }

    function test_withdrawAccruedRevertsWhenEmpty() public {
        vm.expectRevert(LiquidityLocker.NothingAccrued.selector);
        locker.withdrawAccrued();
    }

    function _assertSplit(uint256 prophetShare, uint256 protocolShare) internal pure {
        (uint256 expP, uint256 expR) = Graduation.splitFees(prophetShare + protocolShare);
        assertEq(prophetShare, expP);
        assertEq(protocolShare, expR);
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
