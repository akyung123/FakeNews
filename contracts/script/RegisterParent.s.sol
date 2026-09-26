// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SepoliaConfig} from "./SepoliaConfig.sol";
import {ScriptVm} from "./ScriptVm.sol";

/// Minimal ETHRegistrar surface from contracts-v2 `71a3b73` (docs/ENSV2.md section 6).
interface IETHRegistrar {
    function commit(bytes32 commitment) external;

    function register(
        string memory label,
        address owner,
        bytes32 secret,
        address subregistry,
        address resolver,
        uint64 duration,
        address paymentToken,
        bytes32 referrer
    ) external returns (uint256);

    function makeCommitment(
        string calldata label,
        address owner,
        bytes32 secret,
        address subregistry,
        address resolver,
        uint64 duration,
        bytes32 referrer
    ) external pure returns (bytes32);

    function isAvailable(string memory label) external view returns (bool);

    function commitmentAt(bytes32 commitment) external view returns (uint64);
}

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
}

/// Register the parent label (`prophecy`) on Sepolia ENSv2.
/// A person waits 60 seconds between the two calls. Agents only dry-run.
///
///   ./script/run-sepolia.sh script/RegisterParent.s.sol --sig "commit()"
///   # wait 60s
///   ./script/run-sepolia.sh script/RegisterParent.s.sol --sig "registerName()"
contract RegisterParent is ScriptVm {
    event Commitment(string label, address owner, bytes32 commitment);

    function commit() external {
        (string memory label, address owner, bytes32 secret, uint64 duration) = _params();
        IETHRegistrar registrar = IETHRegistrar(SepoliaConfig.ETH_REGISTRAR);

        require(registrar.isAvailable(label), "label not available");
        bytes32 commitment =
            registrar.makeCommitment(label, owner, secret, address(0), address(0), duration, bytes32(0));

        emit Commitment(label, owner, commitment);

        _start();
        registrar.commit(commitment);
        vm.stopBroadcast();
    }

    function registerName() external {
        (string memory label, address owner, bytes32 secret, uint64 duration) = _params();
        IETHRegistrar registrar = IETHRegistrar(SepoliaConfig.ETH_REGISTRAR);
        IERC20 usdc = IERC20(SepoliaConfig.MOCK_USDC);

        bytes32 commitment =
            registrar.makeCommitment(label, owner, secret, address(0), address(0), duration, bytes32(0));
        uint64 committedAt = registrar.commitmentAt(commitment);
        require(committedAt != 0, "commit first");
        require(block.timestamp >= uint256(committedAt) + 60, "wait 60s after commit");

        _start();
        // Person mints MockUSDC first (infra/README.md). Approve is part of register.
        usdc.approve(address(registrar), type(uint256).max);
        registrar.register(label, owner, secret, address(0), address(0), duration, address(usdc), bytes32(0));
        vm.stopBroadcast();
    }

    function _params() internal view returns (string memory label, address owner, bytes32 secret, uint64 duration) {
        require(block.chainid == SepoliaConfig.CHAIN_ID || block.chainid == 31337, "sepolia or anvil only");
        label = vm.envOr("PARENT_LABEL", string("prophecy"));
        owner = vm.envOr("TEAM_WALLET", address(0));
        secret = vm.envOr("ENS_REGISTRATION_SECRET", bytes32(0));
        duration = uint64(vm.envOr("ENS_DURATION_SECONDS", uint256(365 days)));
        require(bytes(label).length >= 5, "label must be 5+ chars on .eth");
        require(owner != address(0), "set TEAM_WALLET");
        require(secret != bytes32(0), "set ENS_REGISTRATION_SECRET");
    }
}
