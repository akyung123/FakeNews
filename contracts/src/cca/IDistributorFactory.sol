// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Official CCA factory `create` / `getAddress` (v2.1.0).
interface IDistributorFactory {
    function create(address token, uint256 amount, bytes calldata configData, bytes32 salt)
        external
        returns (address distributor);

    function getAddress(address token, uint256 amount, bytes calldata configData, bytes32 salt, address sender)
        external
        view
        returns (address distributor);
}
