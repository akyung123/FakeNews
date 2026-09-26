// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolKey} from "v4-core/src/types/PoolKey.sol";

/// Minimal v4 PositionManager surface for the locker (collect fees + read pool).
interface IPositionManager {
    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable;

    function getPoolAndPositionInfo(uint256 tokenId) external view returns (PoolKey memory poolKey, uint256 info);

    function getPositionLiquidity(uint256 tokenId) external view returns (uint128 liquidity);
}
