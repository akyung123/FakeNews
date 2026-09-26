// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Minimal official CCA / LBPStrategy surfaces for the Sepolia fork spike.
/// Layout matches Uniswap CCA v2.1.0 and liquidity-launcher LBPStrategy v3.3.0.

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

struct PoolParameters {
    uint24 fee;
    int24 tickSpacing;
    address hook;
}

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

interface ICcaFactory {
    function create(address token, uint256 amount, bytes calldata configData, bytes32 salt)
        external
        returns (address);
    function getAddress(address token, uint256 amount, bytes calldata configData, bytes32 salt, address sender)
        external
        view
        returns (address);
}

interface ILbpStrategy {
    function initializeDistribution(address token, uint256 totalSupply, bytes calldata configData, bytes32 salt)
        external;
    function migrate(address initializer) external;
    function initializerFactory() external view returns (address);
    function poolManager() external view returns (address);
    function positionManager() external view returns (address);
    function initializers(address initializer) external view returns (MigratorParameters memory);
}

interface ICca {
    function submitBid(uint256 maxPriceQ96, uint128 amount, address owner, uint256 prevTickPriceQ96, bytes calldata hookData)
        external
        payable
        returns (uint256 bidId);
    function checkpoint() external;
    function clearingPrice() external view returns (uint256);
    function isGraduated() external view returns (bool);
    function exitBid(uint256 bidId) external;
    function claimTokens(uint256 bidId) external;
    function sweepUnsoldTokens() external;
    function startBlock() external view returns (uint64);
    function endBlock() external view returns (uint64);
    function claimBlock() external view returns (uint64);
    function floorPrice() external view returns (uint256);
    function tickSpacing() external view returns (uint256);
    function token() external view returns (address);
    function currency() external view returns (address);
    function totalSupply() external view returns (uint128);
    function tokensRecipient() external view returns (address);
    function fundsRecipient() external view returns (address);
    function lastCheckpointedBlock() external view returns (uint64);
}

interface IInitializerHookView {
    function authorized() external view returns (address);
    function poolManager() external view returns (address);
}
