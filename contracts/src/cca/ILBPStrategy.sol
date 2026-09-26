// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IStrategy} from "./IStrategy.sol";

/// Minimal LBPStrategy surface used by Launchpad.
interface ILBPStrategy is IStrategy {
    function initializerFactory() external view returns (address);
    function migrate(address initializer) external;
}
