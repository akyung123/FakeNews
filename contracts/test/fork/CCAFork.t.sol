// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";

import {CCAForkBase, CCAForkToken, ICca, IInitializerHookView, INITIALIZER_HOOK, LBP_STRATEGY, CCA_FACTORY, SEPOLIA_POOL_MANAGER, SEPOLIA_POSITION_MANAGER, MPS, Q96, CCA_FLOOR_PRICE, CCA_TICK_SPACING, GRADUATION_THRESHOLD, AUCTION_SUPPLY, LP_RESERVE, TOKEN_SUPPLY, V4_FEE, V4_TICK_SPACING, DEFAULT_AUCTION_BLOCKS} from "./CCAForkHelpers.sol";

/// Sepolia-fork spike: official LBPStrategy v3.3.0 + CCA factory v2.1.0.
/// Path B1 evidence only — does not call or edit Launchpad.
///
/// (1) mint ERC-20 + initializeDistribution
/// (2) bids
/// (3) checkpoint / exit (unused ETH refund) / claim
/// (4) migrate opens the v4 pool
/// (5) one swap
/// plus a goal-not-reached case (raised < 0.02 ETH).
contract CCAForkTest is CCAForkBase {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    function setUp() public {
        if (!_maybeFork()) return;
        assertEq(strategy.initializerFactory(), CCA_FACTORY);
        assertEq(strategy.poolManager(), SEPOLIA_POOL_MANAGER);
        assertEq(strategy.positionManager(), SEPOLIA_POSITION_MANAGER);
        assertEq(IInitializerHookView(INITIALIZER_HOOK).authorized(), LBP_STRATEGY);
        assertEq(IInitializerHookView(INITIALIZER_HOOK).poolManager(), SEPOLIA_POOL_MANAGER);
        vm.deal(protocol, 0);
        vm.deal(lpRecipient, 0);
    }

    /// Always-on: documents the step pack and migrationBlock formula for INTERFACE_CCA.md.
    function test_packUniformSteps_25_and_10() public pure {
        bytes memory steps25 = packUniformSteps(25);
        bytes memory steps10 = packUniformSteps(10);
        assertEq(steps25, abi.encodePacked(uint24(400_000), uint40(25)));
        assertEq(steps10, abi.encodePacked(uint24(1_000_000), uint40(10)));
        assertEq(uint256(400_000) * 25, uint256(MPS));
        assertEq(uint256(1_000_000) * 10, uint256(MPS));
        assertEq(migrationBlockAfter(100), 101);
        assertEq(CCA_FLOOR_PRICE, 1000 * Q96);
        assertEq(CCA_TICK_SPACING, 100 * Q96);
        assertEq(uint256(GRADUATION_THRESHOLD), 0.02 ether);
        assertEq(uint256(V4_FEE), 10_000);
        assertEq(int256(V4_TICK_SPACING), 200);
        assertEq(uint256(TOKEN_SUPPLY), uint256(AUCTION_SUPPLY) + uint256(LP_RESERVE));
    }

    function test_forkWiring_officialSepoliaAddresses() public onFork {
        assertTrue(CCA_FACTORY.code.length > 0);
        assertTrue(LBP_STRATEGY.code.length > 0);
        assertTrue(INITIALIZER_HOOK.code.length > 0);
        assertTrue(SEPOLIA_POOL_MANAGER.code.length > 0);
        assertEq(block.number, forkBlock);
    }

    function test_happyPath_25Blocks_createBidSettleMigrateSwap() public onFork {
        _runHappyPath(DEFAULT_AUCTION_BLOCKS, "cca-25");
    }

    function test_happyPath_10Blocks_createBidSettleMigrateSwap() public onFork {
        _runHappyPath(10, "cca-10");
    }

    /// Raised 0.01 ETH < 0.02 ETH threshold. Records the official fail-auction outcomes.
    function test_goalNotReached_refundAndTokenSink() public onFork {
        (ICca auction, CCAForkToken token,) = _createAuction(DEFAULT_AUCTION_BLOCKS, "cca-miss");
        uint128 bidWei = 0.01 ether;
        uint256 bidId = _bid(auction, bidderA, bidWei, 1);
        uint256 ethBeforeExit = bidderA.balance;

        _rollTo(auction.endBlock());
        auction.checkpoint();
        assertFalse(auction.isGraduated(), "must miss 0.02 ETH graduation");
        assertEq(auction.lastCheckpointedBlock(), auction.endBlock());

        vm.prank(bidderA);
        auction.exitBid(bidId);
        uint256 refunded = bidderA.balance - ethBeforeExit;
        assertEq(refunded, bidWei, "failed auction: full ETH refund via exitBid");
        assertEq(token.balanceOf(bidderA), 0, "failed auction: no tokens before claim");

        _rollTo(auction.claimBlock());
        vm.expectRevert();
        auction.claimTokens(bidId);
        assertEq(token.balanceOf(bidderA), 0, "failed auction: claim does not pay tokens");

        uint256 protocolTokBefore = token.balanceOf(protocol);
        vm.prank(protocol);
        auction.sweepUnsoldTokens();
        assertEq(token.balanceOf(protocol) - protocolTokBefore, AUCTION_SUPPLY, "unsold auction supply -> tokensRecipient");
        assertEq(token.balanceOf(address(auction)), 0);
        assertEq(token.balanceOf(LBP_STRATEGY), LP_RESERVE, "LP reserve stays on the strategy until a successful migrate");

        _rollTo(migrationBlockAfter(auction.endBlock()));
        vm.expectRevert();
        strategy.migrate(address(auction));
        assertEq(token.balanceOf(LBP_STRATEGY), LP_RESERVE, "failed migrate does not move the LP reserve");
        assertEq(token.balanceOf(protocol), AUCTION_SUPPLY);
    }

    function _runHappyPath(uint64 auctionBlocks, string memory label) internal {
        (ICca auction, CCAForkToken token,) = _createAuction(auctionBlocks, label);
        assertEq(auction.startBlock(), uint64(block.number));
        assertEq(auction.endBlock(), uint64(block.number) + auctionBlocks);

        uint128 bidA = 0.03 ether;
        uint128 bidB = 0.04 ether;
        uint256 idA = _bid(auction, bidderA, bidA, 1);
        uint256 idB = _bid(auction, bidderB, bidB, 2);
        assertTrue(bidA + bidB > GRADUATION_THRESHOLD);

        _rollTo(auction.endBlock());
        auction.checkpoint();
        assertTrue(auction.isGraduated(), "0.07 ETH must clear the 0.02 ETH threshold");
        assertEq(auction.lastCheckpointedBlock(), auction.endBlock());
        uint256 clearing = auction.clearingPrice();
        assertGe(clearing, CCA_FLOOR_PRICE);

        uint256 ethABefore = bidderA.balance;
        uint256 ethBBefore = bidderB.balance;
        vm.prank(bidderA);
        auction.exitBid(idA);
        vm.prank(bidderB);
        auction.exitBid(idB);
        uint256 refundA = bidderA.balance - ethABefore;
        uint256 refundB = bidderB.balance - ethBBefore;
        assertLe(refundA, bidA);
        assertLe(refundB, bidB);

        _rollTo(auction.claimBlock());
        auction.claimTokens(idA);
        auction.claimTokens(idB);
        uint256 gotA = token.balanceOf(bidderA);
        uint256 gotB = token.balanceOf(bidderB);
        assertGt(gotA, 0, "bidder A claimed tokens");
        assertGt(gotB, 0, "bidder B claimed tokens");
        assertLe(gotA + gotB, AUCTION_SUPPLY);

        _rollTo(migrationBlockAfter(auction.endBlock()));
        strategy.migrate(address(auction));

        PoolKey memory key = PoolKey({
            currency0: CurrencyLibrary.ADDRESS_ZERO,
            currency1: Currency.wrap(address(token)),
            fee: V4_FEE,
            tickSpacing: V4_TICK_SPACING,
            hooks: IHooks(INITIALIZER_HOOK)
        });
        IPoolManager manager = IPoolManager(SEPOLIA_POOL_MANAGER);
        (uint160 sqrtP,,,) = manager.getSlot0(key.toId());
        assertGt(uint256(sqrtP), 0, "migrate must open the v4 pool");

        PoolSwapTest swapper = new PoolSwapTest(manager);
        address trader = address(0x5A0);
        vm.deal(trader, 1 ether);
        uint256 tokBefore = token.balanceOf(trader);
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
        assertGt(token.balanceOf(trader), tokBefore, "one v4 swap after migrate");
    }
}
