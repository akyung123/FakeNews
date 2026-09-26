// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ProphecyFactory} from "../src/ProphecyFactory.sol";
import {SepoliaConfig} from "./SepoliaConfig.sol";
import {ScriptVm} from "./ScriptVm.sol";

/// Sepolia deploy skeleton. Wired to the current factory stub.
///
/// Dry-run:  ./script/run-sepolia.sh script/Deploy.s.sol
/// Send:     ./script/run-sepolia.sh script/Deploy.s.sol --broadcast
///
/// After a send, copy WORLD_CHAIN_ID and WORLD_LAUNCHPAD_ADDRESS from the logs
/// into the world server env.
contract Deploy is ScriptVm {
    event Deployed(string name, address addr);
    event CopyIntoWorldEnv(string name, address value);
    event CopyChainId(string name, uint256 value);

    function run() external {
        uint256 chainId = block.chainid;
        require(chainId == SepoliaConfig.CHAIN_ID || chainId == 31337, "sepolia or anvil only");

        address feeRecipient = vm.envOr("PROTOCOL_FEE_RECIPIENT", address(0));
        address worldSigner = _worldSigner();
        if (vm.envExists("DEPLOYER_PRIVATE_KEY")) {
            require(feeRecipient != address(0), "set PROTOCOL_FEE_RECIPIENT");
            require(worldSigner != address(0), "set WORLD_SIGNER_ADDRESS or WORLD_SIGNER_KEY");
        }

        _start();
        // TODO(backend M1): replace ProphecyFactory with Launchpad.
        // Pass `worldSigner` as the Launchpad constructor argument for the World
        // server signer. There is no setter — constructor only.
        // Exact parameter name lands in the backend M1 PR.
        ProphecyFactory factory = new ProphecyFactory();
        vm.stopBroadcast();

        address deployed = address(factory);
        emit Deployed("ProphecyFactory", deployed);
        emit Deployed("protocolFeeRecipient", feeRecipient);
        emit Deployed("WORLD_SIGNER_ADDRESS", worldSigner);
        emit CopyChainId("WORLD_CHAIN_ID", SepoliaConfig.CHAIN_ID);
        emit CopyIntoWorldEnv("WORLD_LAUNCHPAD_ADDRESS", deployed);
        emit CopyIntoWorldEnv("WORLD_SIGNER_ADDRESS", worldSigner);
    }

    function _worldSigner() internal view returns (address signer) {
        signer = vm.envOr("WORLD_SIGNER_ADDRESS", address(0));
        if (signer == address(0) && vm.envExists("WORLD_SIGNER_KEY")) {
            signer = vm.addr(vm.envUint("WORLD_SIGNER_KEY"));
        }
    }
}
