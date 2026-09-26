// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {FullMath} from "v4-core/src/libraries/FullMath.sol";

import {CcaLib} from "../src/cca/CcaLib.sol";
import {
    AuctionParameters,
    LiquidityAllocationBracket,
    MigratorParameters,
    PositionDefinition
} from "../src/cca/CcaTypes.sol";
import {Graduation} from "../src/uniswap/Graduation.sol";

contract CcaLibTest is Test {
    function test_defaultAuctionBlocksIs25() public pure {
        assertEq(CcaLib.DEFAULT_AUCTION_BLOCKS, 25);
        assertEq(CcaLib.REQUIRED_CURRENCY_RAISED, 0.02 ether);
        assertEq(CcaLib.POOL_FEE, 10_000);
        assertEq(CcaLib.POOL_TICK_SPACING, 200);
        assertEq(CcaLib.AUCTION_SUPPLY + CcaLib.LP_SUPPLY, CcaLib.TOTAL_SUPPLY);
    }

    function test_packSteps25And10SumToMps() public pure {
        _assertSteps(25);
        _assertSteps(10);
    }

    function test_packStepsExactVerifiedPairs() public pure {
        bytes memory n25 = CcaLib.packSteps(25);
        bytes memory n10 = CcaLib.packSteps(10);
        assertEq(n25, abi.encodePacked(uint24(400_000), uint40(25)));
        assertEq(n10, abi.encodePacked(uint24(1_000_000), uint40(10)));
        _assertSteps(1);
    }

    function test_packStepsRejectsNonDivisor() public {
        vm.expectRevert(CcaLib.BadAuctionBlocks.selector);
        this.pack(7);
    }

    function test_scheduleMigrationAfterEnd() public pure {
        (uint64 endBlock, uint64 claimBlock, uint64 migrationBlock) = CcaLib.schedule(10, 100);
        assertEq(endBlock, 110);
        assertEq(claimBlock, 110);
        assertEq(migrationBlock, 111);
        assertGt(migrationBlock, endBlock);
    }

    function test_floorSellsAuctionSupplyAtGraduationLine() public pure {
        uint256 raw = (uint256(CcaLib.REQUIRED_CURRENCY_RAISED) * CcaLib.Q96 + CcaLib.AUCTION_SUPPLY - 1)
            / CcaLib.AUCTION_SUPPLY;
        uint256 tick = (raw + 99) / 100;
        uint256 floor = tick * 100;

        assertEq(CcaLib.AUCTION_TICK_SPACING_Q96, tick);
        assertEq(CcaLib.FLOOR_PRICE_Q96, floor);
        assertEq(CcaLib.FLOOR_PRICE_Q96, 1997936263126070900);
        assertEq(CcaLib.AUCTION_TICK_SPACING_Q96, 19979362631260709);

        assertGe(CcaLib.FLOOR_PRICE_Q96, CcaLib.MIN_FLOOR_PRICE_Q96);
        assertGe(CcaLib.AUCTION_TICK_SPACING_Q96, CcaLib.MIN_AUCTION_TICK_SPACING_Q96);
        assertEq(CcaLib.FLOOR_PRICE_Q96 % CcaLib.AUCTION_TICK_SPACING_Q96, 0);
        assertEq(CcaLib.FLOOR_PRICE_Q96 / CcaLib.AUCTION_TICK_SPACING_Q96, 100);
        assertGe(CcaLib.FLOOR_PRICE_Q96, raw);

        uint256 raisedAtFloor = CcaLib.AUCTION_SUPPLY * CcaLib.FLOOR_PRICE_Q96 / CcaLib.Q96;
        assertEq(raisedAtFloor, CcaLib.REQUIRED_CURRENCY_RAISED);
        assertEq(raisedAtFloor, 0.02 ether);

        // CCA v2.1.0 constructor: floor + tickSpacing <= MAX_BID_PRICE
        // (ContinuousClearingAuction.sol; MaxBidPriceLib.maxBidPrice(auctionSupply)).
        // Auction supply is TOTAL_SUPPLY - LP_SUPPLY (LBP initializeDistribution).
        assertLe(CcaLib.AUCTION_SUPPLY, uint256(1) << 100);
        uint256 maxLiq = uint256((uint256(1) << 154) / CcaLib.AUCTION_SUPPLY) ** 2;
        uint256 maxCur = uint256(1 << 222) / CcaLib.AUCTION_SUPPLY;
        uint256 maxBid = maxLiq < maxCur ? maxLiq : maxCur;
        assertLe(CcaLib.FLOOR_PRICE_Q96 + CcaLib.AUCTION_TICK_SPACING_Q96, maxBid);

        // TokenPricing.convertToPriceX192: (Q192 / floor) must fit uint160 (same as MIN_FLOOR).
        assertEq(((uint256(1) << 192) / CcaLib.FLOOR_PRICE_Q96) >> 160, 0);
    }

    function test_floorSqrtPriceFitsV4TickSpacing200() public pure {
        // LBP TokenPricing.convertToPriceX192(price, currencyIsCurrency0=true): Q192 * Q96 / floor
        uint256 priceX192 = FullMath.mulDiv(uint256(1) << 192, CcaLib.Q96, CcaLib.FLOOR_PRICE_Q96);
        uint160 sqrtPriceX96 = uint160(Graduation.sqrt(priceX192));
        assertEq(sqrtPriceX96, 15777150227996145099409266077380864);
        assertTrue(sqrtPriceX96 >= TickMath.MIN_SQRT_PRICE);
        assertTrue(sqrtPriceX96 < TickMath.MAX_SQRT_PRICE);

        int24 tick = TickMath.getTickAtSqrtPrice(sqrtPriceX96);
        int24 minUsable = TickMath.minUsableTick(CcaLib.POOL_TICK_SPACING);
        int24 maxUsable = TickMath.maxUsableTick(CcaLib.POOL_TICK_SPACING);
        assertGe(tick, minUsable);
        assertLe(tick, maxUsable);
        assertEq(CcaLib.POOL_TICK_SPACING, 200);
        // TickMath tick ≈ 244047; nearest spacing-200 bucket below is 244000.
        assertEq((tick / CcaLib.POOL_TICK_SPACING) * CcaLib.POOL_TICK_SPACING, 244000);
    }

    function test_buildNeverSetsProphetAsRecipient() public pure {
        address token = address(uint160(0x70));
        address strategy = address(uint160(0x5A));
        address protocol = address(uint160(0xFEE));
        address locker = address(uint160(0x10C));
        address hook = address(uint160(0x400));
        address prophet = address(uint160(0xA11CE));

        (bytes memory configData, bytes memory initParams, MigratorParameters memory mp) =
            CcaLib.build(token, strategy, protocol, locker, hook, 10, 50);

        (AuctionParameters memory ap) = abi.decode(initParams, (AuctionParameters));
        assertEq(ap.currency, address(0));
        assertEq(ap.fundsRecipient, strategy);
        assertEq(ap.tokensRecipient, protocol);
        assertTrue(ap.tokensRecipient != prophet);
        assertEq(ap.requiredCurrencyRaised, 0.02 ether);
        assertEq(ap.floorPrice, CcaLib.FLOOR_PRICE_Q96);
        assertEq(ap.tickSpacing, CcaLib.AUCTION_TICK_SPACING_Q96);
        assertEq(ap.endBlock, 60);
        assertEq(ap.claimBlock, 60);
        assertEq(mp.recipient, protocol);
        assertTrue(mp.recipient != prophet);
        assertEq(mp.positionRecipient, locker);
        assertEq(mp.migrationBlock, 61);
        assertEq(mp.reservedTokenAmountForLP, uint128(CcaLib.LP_SUPPLY));
        assertEq(mp.poolParameters.fee, 10_000);
        assertEq(mp.poolParameters.tickSpacing, 200);
        assertEq(mp.poolParameters.hook, hook);

        LiquidityAllocationBracket[] memory brackets =
            abi.decode(mp.lpAllocationSchedule, (LiquidityAllocationBracket[]));
        assertEq(brackets.length, 1);
        assertEq(brackets[0].lowerThreshold, 0);
        assertEq(brackets[0].rate, 1e7);

        PositionDefinition[] memory defs = abi.decode(mp.positionDefinitions, (PositionDefinition[]));
        assertEq(defs.length, 0);

        (MigratorParameters memory decodedMp,) = abi.decode(configData, (MigratorParameters, bytes));
        assertEq(decodedMp.recipient, protocol);
        assertEq(decodedMp.positionRecipient, locker);
    }

    function test_zeroBlocksReverts() public {
        vm.expectRevert(CcaLib.BadAuctionBlocks.selector);
        this.pack(0);
    }

    function pack(uint64 blocks) external pure returns (bytes memory) {
        return CcaLib.packSteps(blocks);
    }

    function _assertSteps(uint64 blocks) internal pure {
        bytes memory packed = CcaLib.packSteps(blocks);
        assertEq(packed.length % 8, 0);
        uint256 total;
        uint256 span;
        for (uint256 i; i < packed.length; i += 8) {
            uint24 mps;
            uint40 delta;
            assembly {
                let word := mload(add(add(packed, 0x20), i))
                mps := shr(232, word)
                delta := and(shr(192, word), 0xFFFFFFFFFF)
            }
            total += uint256(mps) * uint256(delta);
            span += delta;
        }
        assertEq(total, 1e7);
        assertEq(span, blocks);
    }
}
