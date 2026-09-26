// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ProphecyFactory} from "../src/ProphecyFactory.sol";
import {SepoliaConfig} from "./SepoliaConfig.sol";

/// Sepolia deploy skeleton. Wired to the current factory stub.
/// When Launchpad / ProphecyHook / LiquidityLocker land, deploy them here.
/// Compute the hook and launchpad addresses (CREATE2 salt) before sending either.
///
/// Dry-run (default):
///   forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL
/// Broadcast (person only):
///   forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --private-key $DEPLOYER_PRIVATE_KEY
contract Deploy is Script {
    function run() external {
        uint256 chainId = block.chainid;
        require(chainId == SepoliaConfig.CHAIN_ID || chainId == 31337, "sepolia or anvil only");

        address teamWallet = vm.envOr("TEAM_WALLET", address(0));
        address feeRecipient = vm.envOr("PROTOCOL_FEE_RECIPIENT", address(0));
        address worldSigner = vm.envOr("WORLD_SIGNER", address(0));
        address poolManager = vm.envOr("UNISWAP_V4_POOL_MANAGER", SepoliaConfig.POOL_MANAGER);
        bytes32 hookSalt = vm.envOr("HOOK_SALT", bytes32(0));

        console.log("chainId", chainId);
        console.log("teamWallet", teamWallet);
        console.log("protocolFeeRecipient", feeRecipient);
        console.log("worldSigner", worldSigner);
        console.log("poolManager", poolManager);
        console.log("hookSalt");
        console.logBytes32(hookSalt);

        // Without --broadcast this only simulates. Do not pass --broadcast from an agent.
        vm.startBroadcast();
        ProphecyFactory factory = new ProphecyFactory();
        vm.stopBroadcast();

        console.log("ProphecyFactory (current skeleton)", address(factory));
        console.log("next: Launchpad, ProphecyToken, ProphecyHook, LiquidityLocker");
    }
}
