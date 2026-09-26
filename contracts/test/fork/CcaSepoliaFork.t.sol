// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";

import {CcaLib} from "../../src/cca/CcaLib.sol";
import {IProphecyEns} from "../../src/ens/IProphecyEns.sol";
import {Launchpad} from "../../src/Launchpad.sol";
import {ProphecyToken} from "../../src/ProphecyToken.sol";
import {
    CcaSepoliaForkBase,
    ICcaFork,
    IInitializerHookView,
    IPermit2,
    IUniversalRouter,
    CCA_FACTORY,
    INITIALIZER_HOOK,
    LBP_STRATEGY,
    PERMIT2,
    SEPOLIA_POOL_MANAGER,
    SEPOLIA_UNIVERSAL_ROUTER
} from "./CcaSepoliaForkHelpers.sol";

/// Sepolia-fork coverage for PR #42 CcaLib 50/50 constants.
/// Skips when the RPC/fork pin has no official LBP/CCA code (CI sets SEPOLIA_RPC_URL).
contract CcaSepoliaForkTest is CcaSepoliaForkBase {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    uint8 internal constant V4_SWAP = 0x10;
    uint8 internal constant SWAP_EXACT_IN_SINGLE = 0x06;
    uint8 internal constant SETTLE_ALL = 0x0c;
    uint8 internal constant TAKE_ALL = 0x0f;

    struct ExactInputSingle6 {
        PoolKey poolKey;
        bool zeroForOne;
        uint128 amountIn;
        uint128 amountOutMinimum;
        uint256 minHopPriceX36;
        bytes hookData;
    }

    struct ExactInputSingle5 {
        PoolKey poolKey;
        bool zeroForOne;
        uint128 amountIn;
        uint128 amountOutMinimum;
        bytes hookData;
    }

    bool internal usedSixFieldParams = true;

    function setUp() public {
        if (!_maybeFork()) return;
        try this._assertForkWiring() {
            vm.deal(protocol, 0);
            vm.deal(lpRecipient, 0);
        } catch {
            forked = false;
        }
    }

    function _assertForkWiring() external view {
        assertEq(strategy.initializerFactory(), CCA_FACTORY);
        assertEq(IInitializerHookView(INITIALIZER_HOOK).authorized(), LBP_STRATEGY);
    }

    /// Always-on: D) Launchpad auctionBlocks surface + 50/50 constants.
    function test_launchpadAuctionBlocksAndFiftyFiftyConstants() public {
        Launchpad pad = new Launchpad(protocol, address(this), IProphecyEns(address(this)));
        assertEq(pad.auctionBlocks(), 25);
        assertEq(pad.DEFAULT_AUCTION_BLOCKS(), 25);
        pad.setAuctionBlocks(10);
        assertEq(pad.auctionBlocks(), 10);
        vm.expectRevert(Launchpad.BadAuctionBlocks.selector);
        pad.setAuctionBlocks(0);
        vm.expectRevert(Launchpad.BadAuctionBlocks.selector);
        pad.setAuctionBlocks(7);
        vm.prank(bidder);
        vm.expectRevert(Launchpad.NotDeployer.selector);
        pad.setAuctionBlocks(25);

        assertEq(CcaLib.AUCTION_SUPPLY, CcaLib.LP_SUPPLY);
        assertEq(CcaLib.AUCTION_SUPPLY, 500_000_000e18);
        assertEq(CcaLib.FLOOR_PRICE_Q96, 3169126500570573600);
        assertEq(CcaLib.AUCTION_TICK_SPACING_Q96, 31691265005705736);
    }

    function test_demo_25_budget021_twiceFloor() public onFork {
        _runDemo(25, 0.021 ether, CcaLib.FLOOR_PRICE_Q96 * 2, "d25-021-2x", true);
    }

    function test_demo_25_budget020_floorPlusTick() public onFork {
        _runDemo(25, 0.02 ether, CcaLib.FLOOR_PRICE_Q96 + CcaLib.AUCTION_TICK_SPACING_Q96, "d25-020-p1", true);
    }

    function test_demo_10_budget021_twiceFloor() public onFork {
        _runDemo(10, 0.021 ether, CcaLib.FLOOR_PRICE_Q96 * 2, "d10-021-2x", true);
    }

    function test_demo_10_budget020_floorPlusTick() public onFork {
        _runDemo(10, 0.02 ether, CcaLib.FLOOR_PRICE_Q96 + CcaLib.AUCTION_TICK_SPACING_Q96, "d10-020-p1", true);
    }

    /// Unsold early steps roll into remaining supply — a late bid can still graduate.
    function test_rollover_bidFewBlocksAfterStart() public onFork {
        (ICcaFork auction, ProphecyToken token) = _createAuction(25, "roll");
        _rollTo(uint64(block.number + 3));
        uint256 id = _bid(auction, 0.021 ether, CcaLib.FLOOR_PRICE_Q96 * 2);
        _rollTo(auction.endBlock());
        auction.checkpoint();
        assertTrue(auction.isGraduated(), "late bid must still graduate");
        (uint256 refunded, uint256 filled) = _exitClaim(auction, token, id, false);
        emit log_named_uint("rollover refunded", refunded);
        emit log_named_uint("rollover filled", filled);
        assertGt(filled, 0);
    }

    /// Demo path with no separate checkpoint: 0.021 ETH at 2× floor.
    function test_demo_noExternalCheckpoint_budget021_twiceFloor() public onFork {
        (ICcaFork auction, ProphecyToken token) = _createAuction(10, "nocheck-021");
        uint256 maxPrice = CcaLib.FLOOR_PRICE_Q96 * 2;
        assertEq(maxPrice, 6338253001141147200);
        uint256 id = _bid(auction, 0.021 ether, maxPrice);
        _rollTo(auction.endBlock());
        assertEq(auction.lastCheckpointedBlock(), auction.startBlock(), "no external checkpoint");

        uint256 ethBefore = bidder.balance;
        uint256 tokBefore = token.balanceOf(bidder);
        vm.prank(bidder);
        auction.exitBid(id);
        assertEq(bidder.balance - ethBefore, 0, "whole budget used");
        _rollTo(auction.claimBlock());
        auction.claimTokens(id);
        assertGt(token.balanceOf(bidder), tokBefore, "tokens received");
        assertTrue(auction.isGraduated());
    }

    /// maxPrice == clearing ⇒ official `CannotExitBid()` (0x0ba98457).
    function test_exitBidRevertsWhenMaxPriceEqualsClearing() public onFork {
        (ICcaFork auction,) = _createAuction(10, "eq-clear");
        uint256 maxPrice = CcaLib.FLOOR_PRICE_Q96 + CcaLib.AUCTION_TICK_SPACING_Q96;
        uint256 id = _bid(auction, 0.021 ether, maxPrice);
        _rollTo(auction.endBlock());
        auction.checkpoint();
        assertTrue(auction.isGraduated());
        assertEq(auction.clearingPrice(), maxPrice, "maxPrice lands on clearing");
        vm.prank(bidder);
        vm.expectRevert(ICcaFork.CannotExitBid.selector);
        auction.exitBid(id);
    }

    /// Floor graduation leftover ETH swept to protocol is 171 wei.
    function test_floorGraduateLeftoverEthIs171() public onFork {
        DemoOut memory demo = _runDemo(
            10, 0.02 ether, CcaLib.FLOOR_PRICE_Q96 + CcaLib.AUCTION_TICK_SPACING_Q96, "left171", true
        );
        assertEq(demo.leftoverEth, 171);
    }

    /// B) After endBlock, no external checkpoint: exitBid / claimTokens.
    function test_exitClaimWithoutExternalCheckpoint() public onFork {
        (ICcaFork auction, ProphecyToken token) = _createAuction(10, "nocheck");
        uint256 id = _bid(auction, 0.02 ether, CcaLib.FLOOR_PRICE_Q96 + CcaLib.AUCTION_TICK_SPACING_Q96);
        _rollTo(auction.endBlock());
        assertEq(auction.lastCheckpointedBlock(), auction.startBlock(), "no external checkpoint yet");

        uint256 ethBefore = bidder.balance;
        vm.prank(bidder);
        auction.exitBid(id);
        uint256 refunded = bidder.balance - ethBefore;
        emit log_named_uint("nocheck refunded", refunded);
        emit log_named_uint("nocheck lastCheckpoint", auction.lastCheckpointedBlock());
        assertEq(auction.lastCheckpointedBlock(), auction.endBlock(), "exitBid must finalize internally");

        _rollTo(auction.claimBlock());
        uint256 tokBefore = token.balanceOf(bidder);
        auction.claimTokens(id);
        assertGt(token.balanceOf(bidder), tokBefore, "claimTokens works after internal checkpoint");
    }

    /// C) Universal Router 2.1.2 buy + sell after migrate.
    function test_urSwapBuyAndSellAfterMigrate() public onFork {
        DemoOut memory demo =
            _runDemo(25, 0.02 ether, CcaLib.FLOOR_PRICE_Q96 + CcaLib.AUCTION_TICK_SPACING_Q96, "ur-swap", true);
        PoolKey memory key = _poolKey(address(demo.token));
        (uint160 sqrtP,,,) = IPoolManager(SEPOLIA_POOL_MANAGER).getSlot0(key.toId());
        assertGt(uint256(sqrtP), 0, "pool");

        address trader = address(0x5A0);
        vm.deal(trader, 1 ether);
        uint256 tokBefore = demo.token.balanceOf(trader);
        _urBuy(trader, key, 0.001 ether);
        uint256 bought = demo.token.balanceOf(trader) - tokBefore;
        emit log_named_uint("ur buy tokens", bought);
        emit log_named_uint("ur used six-field params", usedSixFieldParams ? 1 : 0);
        assertGt(bought, 0, "buy");

        uint256 sellIn = bought / 2;
        assertGt(sellIn, 0);
        uint256 ethBefore = trader.balance;
        _urSell(trader, demo.token, key, uint128(sellIn));
        emit log_named_uint("ur sell eth out", trader.balance - ethBefore);
        assertGt(trader.balance, ethBefore, "sell");
        assertLt(demo.token.balanceOf(trader), tokBefore + bought);
    }

    struct DemoOut {
        ICcaFork auction;
        ProphecyToken token;
        uint256 clearing;
        uint256 filled;
        uint256 refunded;
        uint256 leftoverEth;
        uint256 leftoverTok;
    }

    function _runDemo(uint64 blocks, uint128 budget, uint256 maxPrice, string memory label, bool migrateAfter)
        internal
        returns (DemoOut memory out)
    {
        (out.auction, out.token) = _createAuction(blocks, label);
        uint256 id = _bid(out.auction, budget, maxPrice);
        _rollTo(out.auction.endBlock());
        out.auction.checkpoint();
        assertTrue(out.auction.isGraduated(), "must graduate");
        out.clearing = out.auction.clearingPrice();
        (out.refunded, out.filled) = _exitClaim(out.auction, out.token, id, false);

        emit log_named_uint("auctionBlocks", blocks);
        emit log_named_uint("budget", budget);
        emit log_named_uint("maxPrice", maxPrice);
        emit log_named_uint("clearing", out.clearing);
        emit log_named_uint("filled", out.filled);
        emit log_named_uint("refunded", out.refunded);
        emit log_named_uint("budgetUsed", uint256(budget) - out.refunded);

        if (!migrateAfter) return out;

        uint256 protoEth = protocol.balance;
        uint256 protoTok = out.token.balanceOf(protocol);
        vm.prank(protocol);
        out.auction.sweepUnsoldTokens();
        uint256 unsold = out.token.balanceOf(protocol) - protoTok;
        _rollTo(out.auction.endBlock() + 1);
        strategy.migrate(address(out.auction));
        out.leftoverEth = protocol.balance - protoEth;
        out.leftoverTok = out.token.balanceOf(protocol) - protoTok;
        emit log_named_uint("unsoldToProtocol", unsold);
        emit log_named_uint("leftoverEth", out.leftoverEth);
        emit log_named_uint("leftoverTok", out.leftoverTok);
        (uint160 sqrtP,,,) = IPoolManager(SEPOLIA_POOL_MANAGER).getSlot0(_poolKey(address(out.token)).toId());
        assertGt(uint256(sqrtP), 0, "migrate opened pool");
    }

    function _urBuy(address trader, PoolKey memory key, uint128 amountIn) internal {
        bytes memory commands = abi.encodePacked(V4_SWAP);
        bytes memory actions = abi.encodePacked(SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL);
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            ExactInputSingle6({
                poolKey: key,
                zeroForOne: true,
                amountIn: amountIn,
                amountOutMinimum: 0,
                minHopPriceX36: 0,
                hookData: ""
            })
        );
        params[1] = abi.encode(key.currency0, amountIn);
        params[2] = abi.encode(key.currency1, uint128(0));
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(actions, params);

        vm.prank(trader);
        try IUniversalRouter(SEPOLIA_UNIVERSAL_ROUTER).execute{value: amountIn}(commands, inputs, block.timestamp + 60)
        {
            usedSixFieldParams = true;
        } catch {
            usedSixFieldParams = false;
            params[0] = abi.encode(
                ExactInputSingle5({
                    poolKey: key, zeroForOne: true, amountIn: amountIn, amountOutMinimum: 0, hookData: ""
                })
            );
            inputs[0] = abi.encode(actions, params);
            vm.prank(trader);
            IUniversalRouter(SEPOLIA_UNIVERSAL_ROUTER).execute{value: amountIn}(commands, inputs, block.timestamp + 60);
        }
    }

    function _urSell(address trader, ProphecyToken token, PoolKey memory key, uint128 amountIn) internal {
        vm.startPrank(trader);
        token.approve(PERMIT2, type(uint256).max);
        IPermit2(PERMIT2).approve(address(token), SEPOLIA_UNIVERSAL_ROUTER, amountIn, uint48(block.timestamp + 1 days));

        bytes memory commands = abi.encodePacked(V4_SWAP);
        bytes memory actions = abi.encodePacked(SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL);
        bytes[] memory params = new bytes[](3);
        if (usedSixFieldParams) {
            params[0] = abi.encode(
                ExactInputSingle6({
                    poolKey: key,
                    zeroForOne: false,
                    amountIn: amountIn,
                    amountOutMinimum: 0,
                    minHopPriceX36: 0,
                    hookData: ""
                })
            );
        } else {
            params[0] = abi.encode(
                ExactInputSingle5({
                    poolKey: key, zeroForOne: false, amountIn: amountIn, amountOutMinimum: 0, hookData: ""
                })
            );
        }
        params[1] = abi.encode(key.currency1, amountIn);
        params[2] = abi.encode(key.currency0, uint128(0));
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(actions, params);
        IUniversalRouter(SEPOLIA_UNIVERSAL_ROUTER).execute(commands, inputs, block.timestamp + 60);
        vm.stopPrank();
    }
}
