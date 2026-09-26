// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Official `IStrategy.initializeDistribution` (liquidity-launcher).
interface IStrategy {
    function initializeDistribution(address token, uint256 totalSupply, bytes calldata configData, bytes32 salt)
        external;
}
