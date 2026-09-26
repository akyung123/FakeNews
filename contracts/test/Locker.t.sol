// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";

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
    uint256 internal tokenId;

    receive() external payable {}

    function setUp() public {
        manager = new PoolManager(address(this));
        token = new ProphecyToken("lingo-2028.prophecy.eth", "LINGO-2028", address(this));
        locker = new LiquidityLocker(manager, address(this), IHooks(hook));
        posm = new MockPositionManager();
        locker.setPositionManager(address(posm));
        locker.prepare(address(token), prophet, protocol);
        tokenId = posm.mintTo(address(locker), address(token), hook);
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
        assertEq(locker.prophetOf(address(token)), prophet);
        uint256[] memory ids = locker.tokenIdsOf(address(token));
        assertEq(ids.length, 1);
        assertEq(ids[0], tokenId);
        assertTrue(locker.isRegistered(address(token), tokenId));
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

        locker.collect(address(token), tokenId);
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
        locker.collect(address(token), tokenId);
        _assertSplit(prophet.balance, protocol.balance);
        _assertSplit(token.balanceOf(prophet), token.balanceOf(protocol));
    }

    function test_collectUnknownReverts() public {
        vm.expectRevert(LiquidityLocker.UnknownLock.selector);
        locker.collect(address(0xDEAD), 1);
    }

    function test_collectUnregisteredTokenIdReverts() public {
        vm.expectRevert(LiquidityLocker.UnknownLock.selector);
        locker.collect(address(token), tokenId + 99);
    }

    function test_secondPrepareReverts() public {
        vm.expectRevert(LiquidityLocker.AlreadyPrepared.selector);
        locker.prepare(address(token), prophet, protocol);
    }

    function test_collectPaysProtocolWhenProphetRejectsEth() public {
        RejectingProphet rejector = new RejectingProphet();
        ProphecyToken tok = new ProphecyToken("reject.prophecy.eth", "REJECT", address(this));
        locker.prepare(address(tok), address(rejector), protocol);
        uint256 id = posm.mintTo(address(locker), address(tok), hook);

        uint256 ethFee = 100;
        vm.deal(address(posm), ethFee);
        posm.setFees(ethFee, address(0), 0);

        uint256 protocolBefore = protocol.balance;
        locker.collect(address(tok), id);
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

/// Official v4 PositionManager `_mint` does not call `onERC721Received`.
contract LockerRegisterTest is Test {
    IPoolManager internal manager;
    LiquidityLocker internal locker;
    MockPositionManager internal posm;
    ProphecyToken internal token;
    address internal hook = address(uint160(0x400C));

    address internal prophet = address(0xA11CE);
    address internal protocol = address(0xFEE);
    address internal attacker = address(0xBAD);

    receive() external payable {}

    function setUp() public {
        manager = new PoolManager(address(this));
        token = new ProphecyToken("lingo-2028.prophecy.eth", "LINGO-2028", address(this));
        locker = new LiquidityLocker(manager, address(this), IHooks(hook));
        posm = new MockPositionManager();
        locker.setPositionManager(address(posm));
        locker.prepare(address(token), prophet, protocol);
    }

    function test_collectRevertsUnknownLockBeforeRegister() public {
        uint256 id = posm.mintSilent(address(locker), address(token), hook);
        assertEq(posm.ownerOf(id), address(locker));
        assertFalse(locker.isRegistered(address(token), id));
        vm.expectRevert(LiquidityLocker.UnknownLock.selector);
        locker.collect(address(token), id);
    }

    function test_registerThenCollectSplits24_76() public {
        uint256 id = posm.mintSilent(address(locker), address(token), hook);
        locker.register(address(token), id);
        uint256[] memory ids = locker.tokenIdsOf(address(token));
        assertEq(ids.length, 1);
        assertEq(ids[0], id);
        assertTrue(locker.isRegistered(address(token), id));

        uint256 ethFee = 100;
        uint256 tokFee = 100;
        token.transfer(address(posm), tokFee);
        vm.deal(address(posm), ethFee);
        posm.setFees(ethFee, address(token), tokFee);

        locker.collect(address(token), id);
        _assertSplit(prophet.balance, protocol.balance);
        _assertSplit(token.balanceOf(prophet), token.balanceOf(protocol));
        assertEq(prophet.balance + protocol.balance, ethFee);
        assertEq(token.balanceOf(prophet) + token.balanceOf(protocol), tokFee);
    }

    function test_frontRunDustDoesNotFreezeRealNft() public {
        uint256 dustId = posm.mintSilent(address(locker), address(token), hook);
        vm.prank(attacker);
        locker.register(address(token), dustId);
        assertTrue(locker.isRegistered(address(token), dustId));

        uint256 realId = posm.mintSilent(address(locker), address(token), hook);
        locker.register(address(token), realId);
        assertTrue(locker.isRegistered(address(token), realId));

        uint256[] memory ids = locker.tokenIdsOf(address(token));
        assertEq(ids.length, 2);
        assertEq(ids[0], dustId);
        assertEq(ids[1], realId);

        uint256 ethFee = 100;
        uint256 tokFee = 100;
        token.transfer(address(posm), tokFee);
        vm.deal(address(posm), ethFee);
        posm.setFees(ethFee, address(token), tokFee);

        locker.collect(address(token), realId);
        _assertSplit(prophet.balance, protocol.balance);
        _assertSplit(token.balanceOf(prophet), token.balanceOf(protocol));
        assertEq(prophet.balance + protocol.balance, ethFee);
        assertEq(token.balanceOf(prophet) + token.balanceOf(protocol), tokFee);
    }

    function test_collectWrongTokenIdReverts() public {
        uint256 id = posm.mintSilent(address(locker), address(token), hook);
        locker.register(address(token), id);

        ProphecyToken other = new ProphecyToken("other.prophecy.eth", "OTHER", address(this));
        locker.prepare(address(other), prophet, protocol);
        uint256 otherId = posm.mintSilent(address(locker), address(other), hook);
        locker.register(address(other), otherId);

        vm.expectRevert(LiquidityLocker.UnknownLock.selector);
        locker.collect(address(token), otherId);
        vm.expectRevert(LiquidityLocker.UnknownLock.selector);
        locker.collect(address(other), id);
        vm.expectRevert(LiquidityLocker.UnknownLock.selector);
        locker.collect(address(token), id + 99);
    }

    function test_registerRevertsWrongOwner() public {
        uint256 id = posm.mintSilent(address(this), address(token), hook);
        vm.expectRevert(LiquidityLocker.NotNftOwner.selector);
        locker.register(address(token), id);
    }

    function test_registerRevertsWrongCurrency() public {
        ProphecyToken other = new ProphecyToken("other.prophecy.eth", "OTHER", address(this));
        uint256 id = posm.mintSilent(address(locker), address(other), hook);
        vm.expectRevert(LiquidityLocker.BadPoolKey.selector);
        locker.register(address(token), id);
    }

    function test_registerRevertsWrongHook() public {
        uint256 id = posm.mintSilent(address(locker), address(token), address(uint160(0xBEEF)));
        vm.expectRevert(LiquidityLocker.BadPoolKey.selector);
        locker.register(address(token), id);
    }

    function test_registerRevertsWrongFeeOrTick() public {
        uint256 badFee = posm.mintSilentWithKey(
            address(locker),
            PoolKey({
                currency0: CurrencyLibrary.ADDRESS_ZERO,
                currency1: Currency.wrap(address(token)),
                fee: 3000,
                tickSpacing: 200,
                hooks: IHooks(hook)
            })
        );
        vm.expectRevert(LiquidityLocker.BadPoolKey.selector);
        locker.register(address(token), badFee);

        uint256 badTick = posm.mintSilentWithKey(
            address(locker),
            PoolKey({
                currency0: CurrencyLibrary.ADDRESS_ZERO,
                currency1: Currency.wrap(address(token)),
                fee: 10_000,
                tickSpacing: 60,
                hooks: IHooks(hook)
            })
        );
        vm.expectRevert(LiquidityLocker.BadPoolKey.selector);
        locker.register(address(token), badTick);

        uint256 badCurrency0 = posm.mintSilentWithKey(
            address(locker),
            PoolKey({
                currency0: Currency.wrap(address(uint160(0xC0))),
                currency1: Currency.wrap(address(token)),
                fee: 10_000,
                tickSpacing: 200,
                hooks: IHooks(hook)
            })
        );
        vm.expectRevert(LiquidityLocker.BadPoolKey.selector);
        locker.register(address(token), badCurrency0);
    }

    function test_registerRevertsNotPrepared() public {
        ProphecyToken other = new ProphecyToken("other.prophecy.eth", "OTHER", address(this));
        uint256 id = posm.mintSilent(address(locker), address(other), hook);
        vm.expectRevert(LiquidityLocker.UnknownLock.selector);
        locker.register(address(other), id);
    }

    function test_registerRevertsDoubleRegister() public {
        uint256 id = posm.mintSilent(address(locker), address(token), hook);
        locker.register(address(token), id);
        vm.expectRevert(LiquidityLocker.AlreadyReceived.selector);
        locker.register(address(token), id);
    }

    function test_registerRevertsAfterCallbackMint() public {
        uint256 id = posm.mintTo(address(locker), address(token), hook);
        assertTrue(locker.isRegistered(address(token), id));
        vm.expectRevert(LiquidityLocker.AlreadyReceived.selector);
        locker.register(address(token), id);
    }

    function test_callbackSecondNftStillRegisters() public {
        uint256 first = posm.mintTo(address(locker), address(token), hook);
        uint256 second = posm.mintTo(address(locker), address(token), hook);
        assertTrue(locker.isRegistered(address(token), first));
        assertTrue(locker.isRegistered(address(token), second));
        uint256[] memory ids = locker.tokenIdsOf(address(token));
        assertEq(ids.length, 2);
        assertEq(ids[0], first);
        assertEq(ids[1], second);

        uint256 ethFee = 100;
        uint256 tokFee = 100;
        token.transfer(address(posm), tokFee);
        vm.deal(address(posm), ethFee);
        posm.setFees(ethFee, address(token), tokFee);
        locker.collect(address(token), second);
        _assertSplit(prophet.balance, protocol.balance);
        _assertSplit(token.balanceOf(prophet), token.balanceOf(protocol));
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
