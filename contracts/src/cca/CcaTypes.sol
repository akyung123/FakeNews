// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// CCA `AuctionParameters` — field order matches ContinuousClearingAuction v2.1.0.
/// https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/IContinuousClearingAuction.sol
struct AuctionParameters {
    address currency;
    address tokensRecipient;
    address fundsRecipient;
    uint64 startBlock;
    uint64 endBlock;
    uint64 claimBlock;
    uint256 tickSpacing;
    address validationHook;
    uint256 floorPrice;
    uint128 requiredCurrencyRaised;
    bytes auctionStepsData;
}

/// LBPStrategy `MigratorParameters` — field order matches liquidity-launcher `1c590491`.
/// https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/libraries/MigratorParams.sol
struct MigratorParameters {
    address token;
    address currency;
    uint64 migrationBlock;
    uint128 reservedTokenAmountForLP;
    address recipient;
    address positionRecipient;
    PoolParameters poolParameters;
    bytes positionDefinitions;
    bytes lpAllocationSchedule;
}

struct PoolParameters {
    uint24 fee;
    int24 tickSpacing;
    address hook;
}

struct LiquidityAllocationBracket {
    uint128 lowerThreshold;
    uint24 rate;
}

struct PositionDefinition {
    int24 offsetLower;
    int24 offsetUpper;
    uint24 weight;
    address overridePositionRecipient;
}
