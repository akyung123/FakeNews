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
    function toString(uint256 value) external pure returns (string memory);
    function toString(bytes32 value) external pure returns (string memory);
    function getNonce(address account) external view returns (uint64);
    function computeCreateAddress(address deployer, uint256 nonce) external pure returns (address);
    function startBroadcast() external;
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

abstract contract ScriptVm {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    /// forge-std DEFAULT_SENDER. Used when DEPLOYER_PRIVATE_KEY is unset (anvil dry-run).
    address internal constant FOUNDRY_DEFAULT_SENDER = address(uint160(uint256(keccak256("foundry default caller"))));

    function _start() internal {
        if (vm.envExists("DEPLOYER_PRIVATE_KEY")) {
            vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        } else {
            vm.startBroadcast();
        }
    }

    function _deployer() internal view returns (address) {
        if (vm.envExists("DEPLOYER_PRIVATE_KEY")) {
            return vm.addr(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        }
        return FOUNDRY_DEFAULT_SENDER;
    }

    /// Single wallet: TEAM_WALLET defaults to the deployer. A different value reverts
    /// so setSubregistry / registrar grants cannot be signed by the wrong key.
    function _teamWallet() internal view returns (address team) {
        address deployer = _deployer();
        team = vm.envOr("TEAM_WALLET", address(0));
        if (team == address(0)) return deployer;
        require(team == deployer, "TEAM_WALLET must equal deployer");
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
