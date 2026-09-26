// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Hooks} from "v4-core/src/libraries/Hooks.sol";

/// CREATE2 salt miner so a hook lands on an address whose low bits match its
/// permission flags. V4 reads those bits; a mismatch means `beforeInitialize`
/// is never called.
///
/// Launchpad CREATE address is predicted from the deployer nonce (after this
/// CREATE2 and the locker CREATE). Pass that predicted address into the hook
/// constructor so the two contracts can point at each other.
library HookMiner {
    uint160 internal constant FLAG_MASK = Hooks.ALL_HOOK_MASK;
    uint256 internal constant MAX_LOOP = 160_000;

    error SaltNotFound();

    /// Permission bits for `ProphecyHook`: `beforeInitialize` only.
    function prophecyFlags() internal pure returns (uint160) {
        return uint160(Hooks.BEFORE_INITIALIZE_FLAG);
    }

    function find(address deployer, uint160 flags, bytes memory creationCode, bytes memory constructorArgs)
        internal
        pure
        returns (address hookAddress, bytes32 salt)
    {
        bytes memory creationCodeWithArgs = abi.encodePacked(creationCode, constructorArgs);
        bytes32 initCodeHash = keccak256(creationCodeWithArgs);
        for (uint256 i; i < MAX_LOOP; ++i) {
            salt = bytes32(i);
            hookAddress = computeAddress(deployer, salt, initCodeHash);
            if (uint160(hookAddress) & FLAG_MASK == flags) {
                return (hookAddress, salt);
            }
        }
        revert SaltNotFound();
    }

    function computeAddress(address deployer, bytes32 salt, bytes32 initCodeHash) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xFF), deployer, salt, initCodeHash)))));
    }
}
