// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";

import {Launchpad} from "../src/Launchpad.sol";
import {ProphecyToken} from "../src/ProphecyToken.sol";
import {CcaLib} from "../src/cca/CcaLib.sol";
import {AuctionParameters, MigratorParameters} from "../src/cca/CcaTypes.sol";
import {HookMiner} from "../src/uniswap/HookMiner.sol";
import {LiquidityLocker} from "../src/uniswap/LiquidityLocker.sol";
import {ProphecyHook} from "../src/uniswap/ProphecyHook.sol";
import {LaunchpadStack} from "./LaunchpadStack.sol";
import {MockAuction, MockLBPStrategy, MockPositionManager} from "./mocks/MockCca.sol";

contract CcaLaunchTest is LaunchpadStack {
    function setUp() public {
        _deployStack();
        vm.deal(prophet, 10 ether);
    }

    function test_launchMintsAndStartsAuction() public {
        address token = _registerAndLaunch();
        address auction = launchpad.auctionOf(token);
        assertTrue(auction != address(0));
        assertTrue(auction.code.length > 0);
        assertFalse(launchpad.isGraduated(token));
        assertEq(ProphecyToken(token).totalSupply(), launchpad.TOTAL_SUPPLY());
        assertEq(ProphecyToken(token).balanceOf(auction), launchpad.AUCTION_SUPPLY());
        assertEq(ProphecyToken(token).balanceOf(address(mockStrategy)), launchpad.LP_SUPPLY());
        assertEq(ProphecyToken(token).balanceOf(address(launchpad)), 0);
        assertEq(ProphecyToken(token).name(), "lingo-2028.ringo.prophecy.eth");
    }

    function test_launchedIndexesTokenProphetAuction() public {
        _registerProphet(prophet, "ringo");
        address predicted = vm.computeCreateAddress(address(launchpad), vm.getNonce(address(launchpad)));
        vm.recordLogs();
        address token = _launch("lingo-2028");
        address auction = launchpad.auctionOf(token);
        assertEq(token, predicted);

        bytes32 topic0 = keccak256("Launched(address,address,address,string,string)");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool found;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != address(launchpad) || logs[i].topics.length < 4) continue;
            if (logs[i].topics[0] != topic0) continue;
            assertEq(address(uint160(uint256(logs[i].topics[1]))), token);
            assertEq(address(uint160(uint256(logs[i].topics[2]))), prophet);
            assertEq(address(uint160(uint256(logs[i].topics[3]))), auction);
            found = true;
        }
        assertTrue(found, "Launched");
    }

    function test_auctionBlocks10ComputesMigrationAfterEnd() public {
        launchpad.setAuctionBlocks(10);
        assertEq(launchpad.auctionBlocks(), 10);
        _registerAndLaunch();
        (MigratorParameters memory stored, bytes memory initializerParams) =
            abi.decode(mockStrategy.lastConfigData(), (MigratorParameters, bytes));
        AuctionParameters memory ap = abi.decode(initializerParams, (AuctionParameters));
        uint64 start = uint64(block.number);
        assertEq(ap.endBlock, start + 10);
        assertEq(ap.claimBlock, ap.endBlock);
        assertEq(stored.migrationBlock, ap.endBlock + 1);
        assertEq(ap.requiredCurrencyRaised, 0.02 ether);
        assertEq(ap.currency, address(0));
        assertEq(ap.floorPrice, uint256(1000) << 96);
        assertEq(ap.tickSpacing, uint256(100) << 96);
    }

    function test_recipientsAreNeverProphet() public {
        _registerAndLaunch();
        (MigratorParameters memory mp, bytes memory initializerParams) =
            abi.decode(mockStrategy.lastConfigData(), (MigratorParameters, bytes));
        AuctionParameters memory ap = abi.decode(initializerParams, (AuctionParameters));
        assertEq(ap.tokensRecipient, protocol);
        assertEq(mp.recipient, protocol);
        assertEq(mp.positionRecipient, address(locker));
        assertEq(ap.fundsRecipient, address(mockStrategy));
        assertTrue(ap.tokensRecipient != prophet);
        assertTrue(mp.recipient != prophet);
        assertTrue(mp.positionRecipient != prophet);
    }

    function test_deadlineIsNotAuctionEnd() public {
        _registerProphet(prophet, "ringo");
        uint64 deadline = 1_900_000_000;
        vm.prank(prophet);
        launchpad.launch("lingo-2028", "a prophecy sentence", deadline);
        (MigratorParameters memory mp, bytes memory initializerParams) =
            abi.decode(mockStrategy.lastConfigData(), (MigratorParameters, bytes));
        AuctionParameters memory ap = abi.decode(initializerParams, (AuctionParameters));
        assertTrue(uint256(ap.endBlock) != uint256(deadline));
        assertTrue(uint256(mp.migrationBlock) != uint256(deadline));
    }

    function test_setCcaRequiresHookAuthorizedToStrategy() public {
        Launchpad pad = new Launchpad(protocol, signer, launchpad.ens());
        MockLBPStrategy strategy = new MockLBPStrategy();
        MockPositionManager posm = new MockPositionManager();
        IPoolManager pm = new PoolManager(address(this));
        address other = address(0xBAD);
        bytes memory ctorArgs = abi.encode(pm, other);
        (, bytes32 salt) =
            HookMiner.find(address(this), HookMiner.prophecyFlags(), type(ProphecyHook).creationCode, ctorArgs);
        ProphecyHook wrongHook = new ProphecyHook{salt: salt}(pm, other);
        LiquidityLocker loc = new LiquidityLocker(pm, address(pad), IHooks(address(wrongHook)));
        pad.setUniswap(pm, address(wrongHook), address(loc));
        vm.expectRevert(Launchpad.InvalidHook.selector);
        pad.setCca(address(strategy), address(posm));
    }

    function test_launchWithoutCcaReverts() public {
        Launchpad pad = new Launchpad(protocol, signer, launchpad.ens());
        _registerProphetOn(pad, prophet, "ringo");
        vm.prank(prophet);
        vm.expectRevert(Launchpad.CcaNotSet.selector);
        pad.launch("lingo-2028", "a prophecy sentence", 1_800_000_000);
    }

    function test_setAuctionBlocksOnlyDeployer() public {
        vm.prank(prophet);
        vm.expectRevert(Launchpad.NotDeployer.selector);
        launchpad.setAuctionBlocks(10);
        vm.expectRevert(Launchpad.BadAuctionBlocks.selector);
        launchpad.setAuctionBlocks(0);
        vm.expectRevert(Launchpad.BadAuctionBlocks.selector);
        launchpad.setAuctionBlocks(7);
    }

    function test_prophetCannotBeProtocolRecipient() public {
        Launchpad pad = _newStack(prophet, signer);
        _registerProphetOn(pad, prophet, "ringo");
        vm.prank(prophet);
        vm.expectRevert(Launchpad.ProphetRecipient.selector);
        pad.launch("lingo-2028", "a prophecy sentence", 1_800_000_000);
    }

    function test_isGraduatedForwardsAuction() public {
        address token = _registerAndLaunch();
        assertFalse(launchpad.isGraduated(token));
        MockAuction(launchpad.auctionOf(token)).setGraduated(true);
        assertTrue(launchpad.isGraduated(token));
        assertFalse(launchpad.isGraduated(address(0xDEAD)));
    }

    function test_constantsMatchCcaLib() public view {
        assertEq(launchpad.TOTAL_SUPPLY(), CcaLib.TOTAL_SUPPLY);
        assertEq(launchpad.AUCTION_SUPPLY(), CcaLib.AUCTION_SUPPLY);
        assertEq(launchpad.LP_SUPPLY(), CcaLib.LP_SUPPLY);
        assertEq(launchpad.REQUIRED_CURRENCY_RAISED(), 0.02 ether);
        assertEq(launchpad.DEFAULT_AUCTION_BLOCKS(), 25);
        assertEq(launchpad.auctionBlocks(), 25);
    }
}
