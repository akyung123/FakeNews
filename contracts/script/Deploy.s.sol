// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ProphecyFactory} from "../src/ProphecyFactory.sol";
import {SepoliaConfig} from "./SepoliaConfig.sol";
import {ScriptVm} from "./ScriptVm.sol";

/// Sepolia deploy skeleton. Wired to the current factory stub until PR #8 merges.
///
/// Launchpad constructor (PR #8):
///   constructor(address protocolFeeRecipient_, address worldSigner_)
/// Both immutable, no setter. Zero address reverts.
///
/// Dry-run:  ./script/run-sepolia.sh script/Deploy.s.sol
/// Send:     ./script/run-sepolia.sh script/Deploy.s.sol --broadcast
///
/// After a send, paste WORLD_CHAIN_ID and WORLD_LAUNCHPAD_ADDRESS into Render
/// and restart. Also print worldSigner address (never the private key).
contract Deploy is ScriptVm {
    event Deployed(string name, address addr);
    event CopyIntoWorldEnv(string name, address value);
    event CopyChainId(string name, uint256 value);
    event PasteIntoRender(string line);

    function run() external {
        uint256 chainId = block.chainid;
        require(chainId == SepoliaConfig.CHAIN_ID || chainId == 31337, "sepolia or anvil only");

        address protocolFeeRecipient = vm.envOr("PROTOCOL_FEE_RECIPIENT", address(0));
        address worldSigner = _worldSigner();
        if (vm.envExists("DEPLOYER_PRIVATE_KEY")) {
            require(protocolFeeRecipient != address(0), "set PROTOCOL_FEE_RECIPIENT");
            require(worldSigner != address(0), "set WORLD_SIGNER_KEY");
        }

        _start();
        // TODO(#8): Launchpad launchpad = new Launchpad(protocolFeeRecipient, worldSigner);
        // constructor(address protocolFeeRecipient_, address worldSigner_)
        // Both public immutable. After deploy (before relying on logs), require both:
        //   require(launchpad.worldSigner() == worldSigner);
        //   require(launchpad.protocolFeeRecipient() == protocolFeeRecipient);
        // A swapped constructor order compiles; the requires fail in dry-run.
        ProphecyFactory factory = new ProphecyFactory();
        vm.stopBroadcast();

        address deployed = address(factory);
        emit Deployed("ProphecyFactory", deployed);
        emit Deployed("protocolFeeRecipient", protocolFeeRecipient);
        emit Deployed("worldSigner", worldSigner);
        emit CopyChainId("WORLD_CHAIN_ID", SepoliaConfig.CHAIN_ID);
        emit CopyIntoWorldEnv("WORLD_LAUNCHPAD_ADDRESS", deployed);
        emit CopyIntoWorldEnv("WORLD_SIGNER_ADDRESS", worldSigner);

        string memory chainLine = "WORLD_CHAIN_ID=11155111";
        string memory launchpadLine = string.concat("WORLD_LAUNCHPAD_ADDRESS=", vm.toString(deployed));
        string memory signerLine = string.concat("worldSigner address: ", vm.toString(worldSigner));
        emit PasteIntoRender(chainLine);
        emit PasteIntoRender(launchpadLine);
        emit PasteIntoRender(signerLine);
        _pasteLine(chainLine);
        _pasteLine(launchpadLine);
        _pasteLine(signerLine);
    }

    /// Source of truth is WORLD_SIGNER_KEY (generated at deploy, never committed).
    function _worldSigner() internal view returns (address signer) {
        if (vm.envExists("WORLD_SIGNER_KEY")) {
            signer = vm.addr(vm.envUint("WORLD_SIGNER_KEY"));
        }
        if (signer == address(0)) {
            signer = vm.envOr("WORLD_SIGNER_ADDRESS", address(0));
        }
    }
}
