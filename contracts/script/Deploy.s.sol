// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IProphecyEns} from "../src/ens/IProphecyEns.sol";
import {ProphecyEns} from "../src/ens/ProphecyEns.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {EnsDeploy} from "./EnsDeploy.sol";
import {SepoliaConfig} from "./SepoliaConfig.sol";
import {ScriptVm} from "./ScriptVm.sol";

/// Sepolia Launchpad + ProphecyEns deploy.
///
/// Constructor (contracts/src/Launchpad.sol):
///   constructor(address protocolFeeRecipient_, address worldSigner_, IProphecyEns ens_)
/// All three public immutable. Zero address reverts.
/// setUniswap(poolManager, hook, locker) is coming in the graduation / lock PR
/// (one deployer-only call). Do not call it from this script — it is not on
/// Launchpad yet.
///
/// Default: create ProphecyEns then Launchpad in ONE broadcast, no other
/// deployer tx in between (same pattern as contracts/test/LaunchpadEns.t.sol):
///   n = vm.getNonce(deployer)
///   predictedPad = vm.computeCreateAddress(deployer, n + 1)
///   new ProphecyEns(predictedPad, parentRegistry, dnsEncode(label.eth), ...)
///   new Launchpad(protocolFeeRecipient, worldSigner, adapter)
///   require(address(launchpad) == predictedPad)
///
/// ENS_ADAPTER_ADDRESS is logged as an output. Optional override: if set, skip
/// the adapter CREATE and pass that address as Launchpad `ens`. Off anvil a set
/// value cannot be address(0) or placeholder 0xe05.
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
        address ensOverride = vm.envOr("ENS_ADAPTER_ADDRESS", address(0));
        bool ensSet = vm.envExists("ENS_ADAPTER_ADDRESS");
        address parentRegistry = vm.envOr("PARENT_USER_REGISTRY", address(0));
        string memory label = vm.envOr("PARENT_LABEL", string("prophecy"));
        address deployer = _deployer();
        _teamWallet();

        if (chainId != 31337) {
            require(vm.envExists("DEPLOYER_PRIVATE_KEY"), "set DEPLOYER_PRIVATE_KEY");
            require(vm.envExists("PROTOCOL_FEE_RECIPIENT"), "set PROTOCOL_FEE_RECIPIENT");
            require(
                vm.envExists("WORLD_SIGNER_KEY") || vm.envExists("WORLD_SIGNER_ADDRESS"),
                "set WORLD_SIGNER_KEY or WORLD_SIGNER_ADDRESS"
            );
            require(
                protocolFeeRecipient != address(0) && protocolFeeRecipient != PLACEHOLDER_FEE,
                "PROTOCOL_FEE_RECIPIENT cannot be zero or placeholder 0xfee"
            );
            require(
                worldSigner != address(0) && worldSigner != PLACEHOLDER_SIGNER,
                "worldSigner cannot be zero or placeholder 0x51e"
            );
            if (ensSet) {
                require(
                    ensOverride != address(0) && ensOverride != PLACEHOLDER_ENS,
                    "ENS_ADAPTER_ADDRESS cannot be zero or placeholder 0xe05"
                );
            }
        } else if (vm.envExists("DEPLOYER_PRIVATE_KEY")) {
            require(protocolFeeRecipient != address(0), "set PROTOCOL_FEE_RECIPIENT");
            require(worldSigner != address(0), "set WORLD_SIGNER_KEY or WORLD_SIGNER_ADDRESS");
        } else {
            // Launchpad reverts on address(0). Placeholders keep anvil dry-run working.
            if (protocolFeeRecipient == address(0)) protocolFeeRecipient = PLACEHOLDER_FEE;
            if (worldSigner == address(0)) worldSigner = PLACEHOLDER_SIGNER;
        }

        // Anvil dry-run: Launchpad only, unless a parent registry is provided.
        bool createAdapter = !ensSet;
        if (chainId == 31337 && !ensSet && parentRegistry == address(0)) {
            createAdapter = false;
            ensOverride = PLACEHOLDER_ENS;
        }
        if (createAdapter) {
            require(parentRegistry != address(0), "set PARENT_USER_REGISTRY");
        }

        _start();
        address ens;
        Launchpad launchpad;
        if (createAdapter) {
            uint64 n = vm.getNonce(deployer);
            address predictedPad = vm.computeCreateAddress(deployer, uint256(n) + 1);
            ProphecyEns adapter = EnsDeploy.deployAdapter(predictedPad, parentRegistry, label);
            launchpad = new Launchpad(protocolFeeRecipient, worldSigner, IProphecyEns(address(adapter)));
            require(address(launchpad) == predictedPad, "launchpad address");
            require(adapter.launchpad() == address(launchpad), "adapter.launchpad");
            require(address(launchpad.ens()) == address(adapter), "launchpad.ens");
            ens = address(adapter);
        } else {
            ens = ensOverride;
            launchpad = new Launchpad(protocolFeeRecipient, worldSigner, IProphecyEns(ens));
            require(address(launchpad.ens()) == ens, "launchpad.ens");
            if (ens.code.length > 0) {
                require(ProphecyEns(ens).launchpad() == address(launchpad), "adapter.launchpad");
            }
        }
        require(launchpad.worldSigner() == worldSigner);
        require(launchpad.protocolFeeRecipient() == protocolFeeRecipient);
        vm.stopBroadcast();

        // TODO(lock / graduation PR): after this broadcast, a later script will
        //   1. mine a CREATE2 salt so Hook permission flags match, using the Launchpad address
        //   2. deploy ProphecyHook (CREATE2) and LiquidityLocker
        //   3. call launchpad.setUniswap(poolManager, hook, locker) once
        //   4. require(launchpad.hook() == hook) and the locker / poolManager views
        // Do not call those functions here — they are not on Launchpad yet.

        address deployed = address(launchpad);
        emit Deployed("Launchpad", deployed);
        emit Deployed("ProphecyEns", ens);
        emit Deployed("protocolFeeRecipient", protocolFeeRecipient);
        emit Deployed("worldSigner", worldSigner);
        emit CopyChainId("WORLD_CHAIN_ID", SepoliaConfig.CHAIN_ID);
        emit CopyIntoWorldEnv("WORLD_LAUNCHPAD_ADDRESS", deployed);
        emit CopyIntoWorldEnv("WORLD_SIGNER_ADDRESS", worldSigner);
        emit CopyIntoWorldEnv("ENS_ADAPTER_ADDRESS", ens);

        string memory chainLine = "WORLD_CHAIN_ID=11155111";
        string memory launchpadLine = string.concat("WORLD_LAUNCHPAD_ADDRESS=", vm.toString(deployed));
        string memory adapterLine = string.concat("ENS_ADAPTER_ADDRESS=", vm.toString(ens));
        string memory signerLine = string.concat("worldSigner address: ", vm.toString(worldSigner));
        emit PasteIntoRender(chainLine);
        emit PasteIntoRender(launchpadLine);
        emit PasteIntoRender(adapterLine);
        emit PasteIntoRender(signerLine);
        _pasteLine(chainLine);
        _pasteLine(launchpadLine);
        _pasteLine(adapterLine);
        _pasteLine(string.concat("LAUNCHPAD_ADDRESS=", vm.toString(deployed)));
        _pasteLine(string.concat("VITE_LAUNCHPAD_ADDRESS=", vm.toString(deployed)));
        _pasteLine(string.concat("VITE_CHAIN_ID=", vm.toString(chainId)));
        _pasteLine(string.concat("DEPLOYER=", vm.toString(deployer)));
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
