// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ProphecyFactory} from "../src/ProphecyFactory.sol";
import {SepoliaConfig} from "./SepoliaConfig.sol";
import {ScriptVm} from "./ScriptVm.sol";

/// Sepolia deploy skeleton. Wired to the current factory stub.
/// When Launchpad lands, pass PROTOCOL_FEE_RECIPIENT and WORLD_SIGNER into its constructor.
///
/// Dry-run:  ./script/run-sepolia.sh script/Deploy.s.sol
/// Send:     ./script/run-sepolia.sh script/Deploy.s.sol --broadcast
contract Deploy is ScriptVm {
    event Deployed(string name, address addr);

    function run() external {
        uint256 chainId = block.chainid;
        require(chainId == SepoliaConfig.CHAIN_ID || chainId == 31337, "sepolia or anvil only");

        address feeRecipient = vm.envOr("PROTOCOL_FEE_RECIPIENT", address(0));
        if (vm.envExists("DEPLOYER_PRIVATE_KEY")) {
            require(feeRecipient != address(0), "set PROTOCOL_FEE_RECIPIENT");
        }

        _start();
        ProphecyFactory factory = new ProphecyFactory();
        vm.stopBroadcast();

        emit Deployed("ProphecyFactory", address(factory));
        emit Deployed("protocolFeeRecipient", feeRecipient);
        emit Deployed("worldSigner", vm.envOr("WORLD_SIGNER", address(0)));
        emit Deployed("poolManager", vm.envOr("UNISWAP_V4_POOL_MANAGER", SepoliaConfig.POOL_MANAGER));
    }
}
