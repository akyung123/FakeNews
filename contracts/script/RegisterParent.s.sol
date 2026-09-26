// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SepoliaConfig} from "./SepoliaConfig.sol";

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
///   forge script script/RegisterParent.s.sol --sig "commit()" --rpc-url $SEPOLIA_RPC_URL
///   # wait 60s
///   forge script script/RegisterParent.s.sol --sig "registerName()" --rpc-url $SEPOLIA_RPC_URL
///
/// Add `--broadcast --private-key $DEPLOYER_PRIVATE_KEY` only as a person.
contract RegisterParent is Script {
    function commit() external {
        (string memory label, address owner, bytes32 secret, uint64 duration) = _params();
        IETHRegistrar registrar = IETHRegistrar(SepoliaConfig.ETH_REGISTRAR);

        bool available = registrar.isAvailable(label);
        bytes32 commitment = registrar.makeCommitment(
            label, owner, secret, address(0), address(0), duration, bytes32(0)
        );

        console.log("label", label);
        console.log("owner", owner);
        console.log("available", available);
        console.log("commitment");
        console.logBytes32(commitment);
        console.log("commitmentAt", uint256(registrar.commitmentAt(commitment)));

        vm.startBroadcast();
        registrar.commit(commitment);
        vm.stopBroadcast();
    }

    function registerName() external {
        (string memory label, address owner, bytes32 secret, uint64 duration) = _params();
        IETHRegistrar registrar = IETHRegistrar(SepoliaConfig.ETH_REGISTRAR);
        IERC20 usdc = IERC20(SepoliaConfig.MOCK_USDC);

        bytes32 commitment = registrar.makeCommitment(
            label, owner, secret, address(0), address(0), duration, bytes32(0)
        );
        console.log("commitmentAt", uint256(registrar.commitmentAt(commitment)));
        console.log("wait until this is at least 60 seconds old, then broadcast");

        vm.startBroadcast();
        // Person mints MockUSDC first (docs/INFRA.md). Approve is part of register.
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
