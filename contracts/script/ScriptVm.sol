// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Cheatcodes only. Do not add forge-std here — contracts/lib and foundry.toml
/// belong to the ENS lane. Ask that lane to `forge install foundry-rs/forge-std`
/// if a later script wants Script.sol / console.sol.
interface Vm {
    function envAddress(string calldata name) external view returns (address);
    function envOr(string calldata name, address defaultValue) external view returns (address);
    function envOr(string calldata name, string calldata defaultValue) external view returns (string memory);
    function envOr(string calldata name, bytes32 defaultValue) external view returns (bytes32);
    function envOr(string calldata name, uint256 defaultValue) external view returns (uint256);
    function envUint(string calldata name) external view returns (uint256);
    function envExists(string calldata name) external view returns (bool);
    function addr(uint256 privateKey) external pure returns (address);
    function toString(address value) external pure returns (string memory);
    function startBroadcast() external;
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

abstract contract ScriptVm {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function _start() internal {
        if (vm.envExists("DEPLOYER_PRIVATE_KEY")) {
            vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        } else {
            vm.startBroadcast();
        }
    }

    /// Foundry console, no forge-std import (that lane owns lib/).
    function _pasteLine(string memory line) internal view {
        bytes memory payload = abi.encodeWithSignature("log(string)", line);
        address console_ = address(0x000000000000000000636F6e736F6c652e6c6f67);
        uint256 len = payload.length;
        assembly {
            pop(staticcall(gas(), console_, add(payload, 32), len, 0, 0))
        }
    }
}
