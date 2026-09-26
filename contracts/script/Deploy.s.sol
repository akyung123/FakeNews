// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";

import {IProphecyEns} from "../src/ens/IProphecyEns.sol";
import {ProphecyEns} from "../src/ens/ProphecyEns.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {CcaLib} from "../src/cca/CcaLib.sol";
import {ProphecyHook} from "../src/uniswap/ProphecyHook.sol";
import {HookMiner} from "../src/uniswap/HookMiner.sol";
import {LiquidityLocker} from "../src/uniswap/LiquidityLocker.sol";
import {EnsDeploy} from "./EnsDeploy.sol";
import {SepoliaConfig} from "./SepoliaConfig.sol";
import {ScriptVm} from "./ScriptVm.sol";

/// Sepolia Launchpad + ProphecyEns + Hook + Locker + CCA wiring.
///
/// Constructor (contracts/src/Launchpad.sol):
///   constructor(address protocolFeeRecipient_, address worldSigner_, IProphecyEns ens_)
/// All three public immutable. Zero address reverts. No setter on those.
/// Floor / tick / supply split are never hardcoded here — they come from CcaLib
/// (Launchpad public constants alias the same values).
///
/// Default: create ProphecyEns then Launchpad in ONE broadcast, no other
/// deployer tx in between (same pattern as contracts/test/LaunchpadEns.t.sol):
///   n = vm.getNonce(deployer)
///   predictedPad = vm.computeCreateAddress(deployer, n + 1)
///   new ProphecyEns(predictedPad, parentRegistry, dnsEncode(label.eth), ...)
///   new Launchpad(protocolFeeRecipient, worldSigner, adapter)
///   require(address(launchpad) == predictedPad)
///
/// Then, still as the deployer (Launchpad.sol: setUniswap then setCca):
///   1. mine a CREATE2 salt (CREATE2_FACTORY = Nick's / Foundry factory) so
///      the hook address low bits match HookMiner.prophecyFlags()
///      (BEFORE_INITIALIZE_FLAG). Constructor stores authorized = LBPStrategy
///      (not the Launchpad).
///   2. new ProphecyHook{salt}(poolManager, lbpStrategy)
///   3. new LiquidityLocker(poolManager, launchpad, hook)
///   4. launchpad.setUniswap(poolManager, hook, locker) exactly once
///   5. launchpad.setCca(lbpStrategy, positionManager) exactly once
///      (also calls locker.setPositionManager)
///   6. require every getter matches
///
/// Official Sepolia addresses live in SepoliaConfig. Overrides:
///   UNISWAP_V4_POOL_MANAGER, LBP_STRATEGY, POSITION_MANAGER,
///   CCA_FACTORY, INITIALIZER_HOOK. Optional HOOK_SALT skips the miner;
///   the salt must still produce the flags.
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
        IPoolManager poolManager = IPoolManager(_officialOrEnv("UNISWAP_V4_POOL_MANAGER", SepoliaConfig.POOL_MANAGER));
        address lbpStrategy = _officialOrEnv("LBP_STRATEGY", SepoliaConfig.LBP_STRATEGY);
        address positionManager = _officialOrEnv("POSITION_MANAGER", SepoliaConfig.POSITION_MANAGER);
        address ccaFactory = _officialOrEnv("CCA_FACTORY", SepoliaConfig.CCA_FACTORY);
        address initializerHook = _officialOrEnv("INITIALIZER_HOOK", SepoliaConfig.INITIALIZER_HOOK);

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
            require(lbpStrategy.code.length > 0, "lbpStrategy has no code");
            require(positionManager.code.length > 0, "positionManager has no code");
            require(ccaFactory.code.length > 0, "ccaFactory has no code");
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
        require(launchpad.TOTAL_SUPPLY() == CcaLib.TOTAL_SUPPLY, "CcaLib.TOTAL_SUPPLY");
        require(launchpad.AUCTION_SUPPLY() == CcaLib.AUCTION_SUPPLY, "CcaLib.AUCTION_SUPPLY");
        require(launchpad.LP_SUPPLY() == CcaLib.LP_SUPPLY, "CcaLib.LP_SUPPLY");
        require(launchpad.REQUIRED_CURRENCY_RAISED() == CcaLib.REQUIRED_CURRENCY_RAISED, "CcaLib.REQUIRED_CURRENCY_RAISED");
        require(launchpad.POOL_FEE() == CcaLib.POOL_FEE, "CcaLib.POOL_FEE");
        require(launchpad.POOL_TICK_SPACING() == CcaLib.POOL_TICK_SPACING, "CcaLib.POOL_TICK_SPACING");
        require(
            launchpad.DEFAULT_AUCTION_BLOCKS() == CcaLib.DEFAULT_AUCTION_BLOCKS, "CcaLib.DEFAULT_AUCTION_BLOCKS"
        );
        require(launchpad.auctionBlocks() == CcaLib.DEFAULT_AUCTION_BLOCKS, "auctionBlocks");

        (address hookAddr, address lockerAddr, bytes32 hookSalt) =
            _wireCca(launchpad, poolManager, lbpStrategy, positionManager);
        _requireWired(launchpad, poolManager, hookAddr, lockerAddr, lbpStrategy, positionManager);
        uint256 deployBlock = block.number;
        vm.stopBroadcast();

        address deployed = address(launchpad);
        emit Deployed("Launchpad", deployed);
        emit Deployed("ProphecyEns", ens);
        emit Deployed("ProphecyHook", hookAddr);
        emit Deployed("LiquidityLocker", lockerAddr);
        emit Deployed("PoolManager", address(poolManager));
        emit Deployed("LBPStrategy", lbpStrategy);
        emit Deployed("PositionManager", positionManager);
        emit Deployed("CcaFactory", ccaFactory);
        emit Deployed("InitializerHook", initializerHook);
        emit Deployed("UniversalRouter", SepoliaConfig.UNIVERSAL_ROUTER);
        emit Deployed("Permit2", SepoliaConfig.PERMIT2);
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
        _pasteLine(string.concat("VITE_LAUNCHPAD_DEPLOY_BLOCK=", vm.toString(deployBlock)));
        _pasteLine(string.concat("VITE_CHAIN_ID=", vm.toString(chainId)));
        _pasteLine(string.concat("HOOK_ADDRESS=", vm.toString(hookAddr)));
        _pasteLine(string.concat("LOCKER_ADDRESS=", vm.toString(lockerAddr)));
        _pasteLine(string.concat("POOL_MANAGER=", vm.toString(address(poolManager))));
        _pasteLine(string.concat("UNISWAP_V4_POOL_MANAGER=", vm.toString(address(poolManager))));
        _pasteLine(string.concat("HOOK_SALT=", vm.toString(hookSalt)));
        _pasteLine(string.concat("VITE_HOOK_ADDRESS=", vm.toString(hookAddr)));
        _pasteLine(string.concat("VITE_LOCKER_ADDRESS=", vm.toString(lockerAddr)));
        _pasteLine(string.concat("LBP_STRATEGY=", vm.toString(lbpStrategy)));
        _pasteLine(string.concat("POSITION_MANAGER=", vm.toString(positionManager)));
        _pasteLine(string.concat("CCA_FACTORY=", vm.toString(ccaFactory)));
        _pasteLine(string.concat("INITIALIZER_HOOK=", vm.toString(initializerHook)));
        _pasteLine(string.concat("UNIVERSAL_ROUTER=", vm.toString(SepoliaConfig.UNIVERSAL_ROUTER)));
        _pasteLine(string.concat("PERMIT2=", vm.toString(SepoliaConfig.PERMIT2)));
        _pasteLine(string.concat("CCA_TOTAL_SUPPLY=", vm.toString(CcaLib.TOTAL_SUPPLY)));
        _pasteLine(string.concat("CCA_AUCTION_SUPPLY=", vm.toString(CcaLib.AUCTION_SUPPLY)));
        _pasteLine(string.concat("CCA_LP_SUPPLY=", vm.toString(CcaLib.LP_SUPPLY)));
        _pasteLine(string.concat("CCA_REQUIRED_CURRENCY_RAISED=", vm.toString(uint256(CcaLib.REQUIRED_CURRENCY_RAISED))));
        _pasteLine(string.concat("CCA_FLOOR_PRICE_Q96=", vm.toString(CcaLib.FLOOR_PRICE_Q96)));
        _pasteLine(string.concat("CCA_AUCTION_TICK_SPACING_Q96=", vm.toString(CcaLib.AUCTION_TICK_SPACING_Q96)));
        _pasteLine(string.concat("CCA_POOL_FEE=", vm.toString(uint256(CcaLib.POOL_FEE))));
        _pasteLine(string.concat("CCA_POOL_TICK_SPACING=", vm.toString(uint256(uint24(CcaLib.POOL_TICK_SPACING)))));
        _pasteLine(string.concat("CCA_DEFAULT_AUCTION_BLOCKS=", vm.toString(uint256(CcaLib.DEFAULT_AUCTION_BLOCKS))));
        _pasteLine(string.concat("AUCTION_BLOCKS=", vm.toString(uint256(launchpad.auctionBlocks()))));
        _pasteLine(string.concat("DEPLOYER=", vm.toString(deployer)));
        _pasteLine(signerLine);
    }

    /// Official Sepolia address, or a same-name env override when set and non-zero.
    function _officialOrEnv(string memory name, address fallback_) internal view returns (address value) {
        value = vm.envOr(name, address(0));
        if (value == address(0)) value = fallback_;
        require(value != address(0), name);
    }

    /// CREATE2 Hook (mined flags, LBPStrategy as authorized), Locker, then
    /// deployer-only setUniswap once and setCca once. Salt is mined for
    /// CREATE2_FACTORY because forge script `new Hook{salt}` goes through that
    /// factory, not the EOA.
    function _wireCca(
        Launchpad launchpad,
        IPoolManager poolManager,
        address lbpStrategy,
        address positionManager
    ) internal returns (address hookAddr, address lockerAddr, bytes32 salt) {
        bytes memory ctorArgs = abi.encode(poolManager, lbpStrategy);
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
        ProphecyHook hook = new ProphecyHook{salt: salt}(poolManager, lbpStrategy);
        require(address(hook) == predicted, "hook address");
        require(uint160(address(hook)) & HookMiner.FLAG_MASK == HookMiner.prophecyFlags(), "hook flags");
        require(hook.authorized() == lbpStrategy, "hook.authorized");
        require(address(hook.poolManager()) == address(poolManager), "hook.poolManager");
        LiquidityLocker locker = new LiquidityLocker(poolManager, address(launchpad), IHooks(address(hook)));
        launchpad.setUniswap(poolManager, address(hook), address(locker));
        launchpad.setCca(lbpStrategy, positionManager);
        hookAddr = address(hook);
        lockerAddr = address(locker);
    }

    function _requireWired(
        Launchpad launchpad,
        IPoolManager poolManager,
        address hookAddr,
        address lockerAddr,
        address lbpStrategy,
        address positionManager
    ) internal view {
        require(address(launchpad.hook()) == hookAddr, "launchpad.hook");
        require(address(launchpad.locker()) == lockerAddr, "launchpad.locker");
        require(address(launchpad.poolManager()) == address(poolManager), "launchpad.poolManager");
        require(address(launchpad.lbpStrategy()) == lbpStrategy, "launchpad.lbpStrategy");
        require(launchpad.positionManager() == positionManager, "launchpad.positionManager");
        LiquidityLocker locker = LiquidityLocker(payable(lockerAddr));
        require(locker.launchpad() == address(launchpad), "locker.launchpad");
        require(address(locker.hook()) == hookAddr, "locker.hook");
        require(address(locker.poolManager()) == address(poolManager), "locker.poolManager");
        require(address(locker.positionManager()) == positionManager, "locker.positionManager");
        require(ProphecyHook(hookAddr).authorized() == lbpStrategy, "wired hook.authorized");
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
