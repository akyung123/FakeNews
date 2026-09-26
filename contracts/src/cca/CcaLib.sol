// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    AuctionParameters,
    LiquidityAllocationBracket,
    MigratorParameters,
    PoolParameters,
    PositionDefinition
} from "./CcaTypes.sol";

/// Encodes official LBPStrategy `configData` and the CCA step schedule.
/// Auction length is not a constant: callers pass `auctionBlocks`.
library CcaLib {
    uint256 internal constant TOTAL_SUPPLY = 1_000_000_000e18;
    uint256 internal constant AUCTION_SUPPLY = 793_100_000e18;
    uint256 internal constant LP_SUPPLY = 206_900_000e18;
    uint128 internal constant REQUIRED_CURRENCY_RAISED = 0.02 ether;
    uint24 internal constant POOL_FEE = 10_000;
    int24 internal constant POOL_TICK_SPACING = 200;
    uint64 internal constant DEFAULT_AUCTION_BLOCKS = 25;
    uint24 internal constant MPS = 1e7;
    uint24 internal constant LP_BRACKET_RATE = 1e7;
    uint256 internal constant Q96 = 1 << 96;

    /// Official CCA v2.1.0 `ConstantsLib`: floor >= 2^32+1, tickSpacing >= 2,
    /// and `floor % tickSpacing == 0` (`TickStorage._getTick`).
    uint256 internal constant MIN_FLOOR_PRICE_Q96 = (uint256(1) << 32) + 1;
    uint256 internal constant MIN_AUCTION_TICK_SPACING_Q96 = 2;

    /// Q96 currency-wei per token-wei. The official harness `1000<<96` / `100<<96`
    /// was for an 800e18 toy token; at our 793.1M auction supply that floor would
    /// raise ~793.1 billion ETH. Floor here is set so selling the full auction
    /// supply at floor raises the 0.02 ETH graduation line:
    ///   raw = ceil(REQUIRED_CURRENCY_RAISED * Q96 / AUCTION_SUPPLY)
    ///   tick = ceil(raw / 100)   // 1% of floor (CCA docs: at least 1 bp; 1% or 10% ok)
    ///   floor = tick * 100       // so floor % tick == 0 and floor >= raw
    /// Constructor also requires floor + tickSpacing <= MAX_BID_PRICE
    /// (MaxBidPriceLib.maxBidPrice(auctionSupply)).
    uint256 internal constant _RAW_FLOOR_PRICE_Q96 =
        (uint256(REQUIRED_CURRENCY_RAISED) * Q96 + AUCTION_SUPPLY - 1) / AUCTION_SUPPLY;
    uint256 internal constant AUCTION_TICK_SPACING_Q96 = (_RAW_FLOOR_PRICE_Q96 + 99) / 100;
    uint256 internal constant FLOOR_PRICE_Q96 = AUCTION_TICK_SPACING_Q96 * 100;

    error BadAuctionBlocks();
    error ProphetRecipient();

    /// Uniform issuance: `mps * N == 1e7`. N must divide 1e7 (25 → 400_000, 10 → 1_000_000).
    function packSteps(uint64 auctionBlocks) internal pure returns (bytes memory) {
        if (auctionBlocks == 0 || uint256(MPS) % uint256(auctionBlocks) != 0) revert BadAuctionBlocks();
        uint24 mps = uint24(uint256(MPS) / uint256(auctionBlocks));
        return abi.encodePacked(mps, uint40(auctionBlocks));
    }

    function schedule(uint64 auctionBlocks, uint64 startBlock)
        internal
        pure
        returns (uint64 endBlock, uint64 claimBlock, uint64 migrationBlock)
    {
        if (auctionBlocks == 0) revert BadAuctionBlocks();
        endBlock = startBlock + auctionBlocks;
        claimBlock = endBlock;
        migrationBlock = endBlock + 1;
    }

    function lpAllocationSchedule() internal pure returns (bytes memory) {
        LiquidityAllocationBracket[] memory brackets = new LiquidityAllocationBracket[](1);
        brackets[0] = LiquidityAllocationBracket({lowerThreshold: 0, rate: LP_BRACKET_RATE});
        return abi.encode(brackets);
    }

    function emptyPositionDefinitions() internal pure returns (bytes memory) {
        return abi.encode(new PositionDefinition[](0));
    }

    /// `tokensRecipient` and `recipient` must never be the prophet — caller passes protocol.
    function build(
        address token,
        address lbpStrategy,
        address protocol,
        address locker,
        address hook,
        uint64 auctionBlocks,
        uint64 startBlock
    ) internal pure returns (bytes memory configData, bytes memory initializerParams, MigratorParameters memory mp) {
        if (protocol == address(0)) revert ProphetRecipient();
        (uint64 endBlock, uint64 claimBlock, uint64 migrationBlock) = schedule(auctionBlocks, startBlock);

        AuctionParameters memory ap = AuctionParameters({
            currency: address(0),
            tokensRecipient: protocol,
            fundsRecipient: lbpStrategy,
            startBlock: startBlock,
            endBlock: endBlock,
            claimBlock: claimBlock,
            tickSpacing: AUCTION_TICK_SPACING_Q96,
            validationHook: address(0),
            floorPrice: FLOOR_PRICE_Q96,
            requiredCurrencyRaised: REQUIRED_CURRENCY_RAISED,
            auctionStepsData: packSteps(auctionBlocks)
        });
        initializerParams = abi.encode(ap);

        mp = MigratorParameters({
            token: token,
            currency: address(0),
            migrationBlock: migrationBlock,
            reservedTokenAmountForLP: uint128(LP_SUPPLY),
            recipient: protocol,
            positionRecipient: locker,
            poolParameters: PoolParameters({fee: POOL_FEE, tickSpacing: POOL_TICK_SPACING, hook: hook}),
            positionDefinitions: emptyPositionDefinitions(),
            lpAllocationSchedule: lpAllocationSchedule()
        });
        configData = abi.encode(mp, initializerParams);
    }
}
