// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";

import {IProphecyEns} from "../src/ens/IProphecyEns.sol";
import {ProphecyEns} from "../src/ens/ProphecyEns.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {ProphecyHook} from "../src/uniswap/ProphecyHook.sol";
import {HookMiner} from "../src/uniswap/HookMiner.sol";
import {LiquidityLocker} from "../src/uniswap/LiquidityLocker.sol";
import {EnsDeploy} from "./EnsDeploy.sol";
import {SepoliaConfig} from "./SepoliaConfig.sol";
import {ScriptVm} from "./ScriptVm.sol";

/// Sepolia Launchpad + ProphecyEns + Hook + Locker deploy.
///
/// Constructor (contracts/src/Launchpad.sol):
///   constructor(address protocolFeeRecipient_, address worldSigner_, IProphecyEns ens_)
/// All three public immutable. Zero address reverts. No setter on those.
///
/// Default: create ProphecyEns then Launchpad in ONE broadcast, no other
/// deployer tx in between (same pattern as contracts/test/LaunchpadEns.t.sol):
///   n = vm.getNonce(deployer)
///   predictedPad = vm.computeCreateAddress(deployer, n + 1)
///   new ProphecyEns(predictedPad, parentRegistry, dnsEncode(label.eth), ...)
///   new Launchpad(protocolFeeRecipient, worldSigner, adapter)
///   require(address(launchpad) == predictedPad)
///
/// Then, still as the deployer (INTERFACE §2 / LaunchpadStack._wireUniswap):
///   1. mine a CREATE2 salt (CREATE2_FACTORY = Nick's / Foundry factory) so
///      the hook address low bits match HookMiner.prophecyFlags()
///      (BEFORE_INITIALIZE_FLAG), using the Launchpad address as constructor input
///   2. new ProphecyHook{salt}(poolManager, launchpad)
///   3. new LiquidityLocker(poolManager, launchpad, hook)
///   4. launchpad.setUniswap(poolManager, hook, locker) exactly once
///   5. require hook() / locker() / poolManager() match
///
/// PoolManager is the official Uniswap v4 Sepolia deployment
/// (https://docs.uniswap.org/contracts/v4/deployments — same address as
/// SepoliaConfig.POOL_MANAGER). Override with UNISWAP_V4_POOL_MANAGER.
/// Optional HOOK_SALT skips the miner; the salt must still produce the flags.
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

    /// Arachnid/Foundry CREATE2 factory. `new Foo{salt}` in a forge script
    /// deploys through this address, not the EOA. Same address as
    /// forge-std `CREATE2_FACTORY` / Nick's factory; present on Sepolia.
    address internal constant CREATE2_FACTORY = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

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
        IPoolManager poolManager = _poolManager();

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
            require(address(poolManager).code.length > 0, "poolManager has no code");
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

        (address hookAddr, address lockerAddr, bytes32 hookSalt) = _wireUniswap(launchpad, poolManager);
        require(address(launchpad.hook()) == hookAddr, "launchpad.hook");
        require(address(launchpad.locker()) == lockerAddr, "launchpad.locker");
        require(address(launchpad.poolManager()) == address(poolManager), "launchpad.poolManager");
        vm.stopBroadcast();

        address deployed = address(launchpad);
        emit Deployed("Launchpad", deployed);
        emit Deployed("ProphecyEns", ens);
        emit Deployed("ProphecyHook", hookAddr);
        emit Deployed("LiquidityLocker", lockerAddr);
        emit Deployed("PoolManager", address(poolManager));
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
        _pasteLine(string.concat("HOOK_ADDRESS=", vm.toString(hookAddr)));
        _pasteLine(string.concat("LOCKER_ADDRESS=", vm.toString(lockerAddr)));
        _pasteLine(string.concat("POOL_MANAGER=", vm.toString(address(poolManager))));
        _pasteLine(string.concat("UNISWAP_V4_POOL_MANAGER=", vm.toString(address(poolManager))));
        _pasteLine(string.concat("HOOK_SALT=", vm.toString(hookSalt)));
        _pasteLine(string.concat("VITE_HOOK_ADDRESS=", vm.toString(hookAddr)));
        _pasteLine(string.concat("VITE_LOCKER_ADDRESS=", vm.toString(lockerAddr)));
        _pasteLine(string.concat("DEPLOYER=", vm.toString(deployer)));
        _pasteLine(signerLine);
    }

    /// Official Uniswap v4 Sepolia PoolManager, or UNISWAP_V4_POOL_MANAGER.
    function _poolManager() internal view returns (IPoolManager) {
        address pm = vm.envOr("UNISWAP_V4_POOL_MANAGER", address(0));
        if (pm == address(0)) pm = SepoliaConfig.POOL_MANAGER;
        require(pm != address(0), "poolManager");
        return IPoolManager(pm);
    }

    /// CREATE2 Hook (mined flags, Launchpad in the constructor), Locker, then
    /// deployer-only setUniswap once. Salt is mined for CREATE2_FACTORY because
    /// forge script `new Hook{salt}` goes through that factory, not the EOA.
    function _wireUniswap(Launchpad launchpad, IPoolManager poolManager)
        internal
        returns (address hookAddr, address lockerAddr, bytes32 salt)
    {
        bytes memory ctorArgs = abi.encode(poolManager, address(launchpad));
        address predicted;
        salt = vm.envOr("HOOK_SALT", bytes32(0));
        if (salt == bytes32(0)) {
            (predicted, salt) =
                HookMiner.find(CREATE2_FACTORY, HookMiner.prophecyFlags(), type(ProphecyHook).creationCode, ctorArgs);
        } else {
            bytes32 initCodeHash = keccak256(abi.encodePacked(type(ProphecyHook).creationCode, ctorArgs));
            predicted = HookMiner.computeAddress(CREATE2_FACTORY, salt, initCodeHash);
            require(uint160(predicted) & HookMiner.FLAG_MASK == HookMiner.prophecyFlags(), "HOOK_SALT flags");
        }
        ProphecyHook hook = new ProphecyHook{salt: salt}(poolManager, address(launchpad));
        require(address(hook) == predicted, "hook address");
        require(uint160(address(hook)) & HookMiner.FLAG_MASK == HookMiner.prophecyFlags(), "hook flags");
        LiquidityLocker locker = new LiquidityLocker(poolManager, address(launchpad), IHooks(address(hook)));
        launchpad.setUniswap(poolManager, address(hook), address(locker));
        hookAddr = address(hook);
        lockerAddr = address(locker);
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
