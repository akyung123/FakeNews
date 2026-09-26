// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Official IStrategy.initializeDistribution — LBPStrategy pulls `totalSupply`.
/// https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/interfaces/IStrategy.sol
interface IStrategy {
    function initializeDistribution(address token, uint256 totalSupply, bytes calldata configData, bytes32 salt)
        external;
}

interface ILBPStrategy is IStrategy {
    function initializerFactory() external view returns (address);
}

/// Official CCA views the UI needs. `isGraduated` may be stale until `checkpoint`.
/// https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/IContinuousClearingAuction.sol
///
/// Official events (same file, v2.1.0). First `submitBid` id is 0 (PR #41).
///   event BidSubmitted(uint256 indexed id, address indexed owner, uint256 priceQ96, uint128 amount);
///   event BidExited(uint256 indexed bidId, address indexed owner, uint256 tokensFilled, uint256 currencyRefunded);
///   event TokensClaimed(uint256 indexed bidId, address indexed owner, uint256 tokensFilled);
///   event TokensReceived(uint128 totalSupply);
/// v4 `Swap` `sender` is usually the router — do not attribute it to a user.
///
/// Goal not reached (`isGraduated == false` after checkpoint):
///   `exitBid` refunds the full ETH; `claimTokens` reverts `NotGraduated`;
///   unsold auction tokens go to `tokensRecipient` (protocol);
///   `migrate` does not revert and returns the LP reserve to `recipient` (protocol);
///   no pool opens.
interface ICca {
    function isGraduated() external view returns (bool);
    function startBlock() external view returns (uint64);
    function endBlock() external view returns (uint64);
    function claimBlock() external view returns (uint64);
}

/// Official factory v2.1.0 — `create`, not `initializeDistribution`.
/// https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuctionFactory.sol
interface IDistributorFactory {
    function create(address token, uint256 amount, bytes calldata configData, bytes32 salt)
        external
        returns (address distributor);

    function getAddress(address token, uint256 amount, bytes calldata configData, bytes32 salt, address sender)
        external
        view
        returns (address distributor);
}
