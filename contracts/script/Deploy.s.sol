// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IProphecyEns} from "../src/ens/IProphecyEns.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {SepoliaConfig} from "./SepoliaConfig.sol";
import {ScriptVm} from "./ScriptVm.sol";

/// Sepolia Launchpad deploy.
///
/// Constructor (contracts/src/Launchpad.sol):
///   constructor(address protocolFeeRecipient_, address worldSigner_, IProphecyEns ens_)
/// All three public immutable. Zero address reverts. No setter.
/// `ens` comes from ENS_ADAPTER_ADDRESS. Off anvil: required; reject 0 and
/// placeholder 0xe05 (same pattern as PROTOCOL_FEE_RECIPIENT / 0xfee).
/// Anvil dry-run fills 0xe05 when unset. Infra adds the name to .env.example.
///
/// Dry-run:  ./script/run-sepolia.sh script/Deploy.s.sol
/// Send:     ./script/run-sepolia.sh script/Deploy.s.sol --broadcast
///
/// After a send, paste WORLD_CHAIN_ID and WORLD_LAUNCHPAD_ADDRESS into Render
/// and restart. Also print worldSigner address (never the private key).
contract Deploy is ScriptVm {
    /// Anvil dry-run only. Never accepted on Sepolia (or any non-31337 chain).
    address internal constant PLACEHOLDER_FEE = address(uint160(0xfee));
    address internal constant PLACEHOLDER_SIGNER = address(uint160(0x51e));
    address internal constant PLACEHOLDER_ENS = address(uint160(0xe05));

    event Deployed(string name, address addr);
    event CopyIntoWorldEnv(string name, address value);
    event CopyChainId(string name, uint256 value);
    event PasteIntoRender(string line);

    function run() external {
        uint256 chainId = block.chainid;
        require(chainId == SepoliaConfig.CHAIN_ID || chainId == 31337, "sepolia or anvil only");

        address protocolFeeRecipient = vm.envOr("PROTOCOL_FEE_RECIPIENT", address(0));
        address worldSigner = _worldSigner();
        address ens = vm.envOr("ENS_ADAPTER_ADDRESS", address(0));
        if (chainId != 31337) {
            require(vm.envExists("DEPLOYER_PRIVATE_KEY"), "set DEPLOYER_PRIVATE_KEY");
            require(vm.envExists("PROTOCOL_FEE_RECIPIENT"), "set PROTOCOL_FEE_RECIPIENT");
            require(
                vm.envExists("WORLD_SIGNER_KEY") || vm.envExists("WORLD_SIGNER_ADDRESS"),
                "set WORLD_SIGNER_KEY"
            );
            require(vm.envExists("ENS_ADAPTER_ADDRESS"), "set ENS_ADAPTER_ADDRESS");
            require(
                protocolFeeRecipient != address(0) && protocolFeeRecipient != PLACEHOLDER_FEE,
                "PROTOCOL_FEE_RECIPIENT cannot be zero or placeholder 0xfee"
            );
            require(
                worldSigner != address(0) && worldSigner != PLACEHOLDER_SIGNER,
                "worldSigner cannot be zero or placeholder 0x51e"
            );
            require(
                ens != address(0) && ens != PLACEHOLDER_ENS,
                "ENS_ADAPTER_ADDRESS cannot be zero or placeholder 0xe05"
            );
        } else if (vm.envExists("DEPLOYER_PRIVATE_KEY")) {
            require(protocolFeeRecipient != address(0), "set PROTOCOL_FEE_RECIPIENT");
            require(worldSigner != address(0), "set WORLD_SIGNER_KEY");
            require(ens != address(0), "set ENS_ADAPTER_ADDRESS");
        } else {
            // Launchpad reverts on address(0). Placeholders keep anvil dry-run working.
            if (protocolFeeRecipient == address(0)) protocolFeeRecipient = PLACEHOLDER_FEE;
            if (worldSigner == address(0)) worldSigner = PLACEHOLDER_SIGNER;
            if (ens == address(0)) ens = PLACEHOLDER_ENS;
        }

        _start();
        Launchpad launchpad = new Launchpad(protocolFeeRecipient, worldSigner, IProphecyEns(ens));
        require(launchpad.worldSigner() == worldSigner);
        require(launchpad.protocolFeeRecipient() == protocolFeeRecipient);
        require(address(launchpad.ens()) == ens);
        vm.stopBroadcast();

        address deployed = address(launchpad);
        emit Deployed("Launchpad", deployed);
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
