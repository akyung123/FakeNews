// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";

import {IProphecyEns} from "../src/ens/IProphecyEns.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {ProphecyHook} from "../src/uniswap/ProphecyHook.sol";
import {HookMiner} from "../src/uniswap/HookMiner.sol";
import {LiquidityLocker} from "../src/uniswap/LiquidityLocker.sol";
import {LaunchpadTestBase, MockProphecyEns} from "./LaunchpadHelpers.sol";

// Official Uniswap v4 PoolManager on Sepolia (docs + SepoliaConfig).
address constant SEPOLIA_POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;

/// Prophet that can refuse ETH so `collect` accrues the share for `withdrawAccrued`.
contract RejectEthProphet {
    bool public accept;

    function setAccept(bool v) external {
        accept = v;
    }

    receive() external payable {
        if (!accept) revert();
    }

    function withdraw(LiquidityLocker loc) external {
        loc.withdrawAccrued();
    }
}

/// Sepolia-fork address book and local-on-fork deploy.
///
/// Address source, in order: `deployments/sepolia.json` (json → env → local
/// deploy). Does not re-run the infra #30 parent-register / UserRegistry flow.
abstract contract ForkE2EBase is LaunchpadTestBase {
    /// Recent Sepolia head (around 11_783_904). Public archive-less RPCs may
    /// reject it; `_maybeFork` then falls back to latest.
    uint256 internal constant FORK_BLOCK = 11_783_800;

    IPoolManager internal manager;
    ProphecyHook internal hook;
    LiquidityLocker internal locker;

    bool internal forked;
    bool internal locallyDeployed;

    uint256 internal signerPk = SIGNER_PK;

    address internal resolvedLaunchpad;
    address internal resolvedHook;
    address internal resolvedLocker;
    address internal resolvedPoolManager;
    address internal resolvedAdapter;
    address internal resolvedParentRegistry;
    uint256 internal resolvedLaunchpadBlock;

    receive() external payable {}

    /// Skip the whole suite when the RPC secret is unset so default CI stays green.
    function _maybeFork() internal returns (bool) {
        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            return false;
        }
        _peekDeploymentRecord();
        uint256 pin = vm.envOr("SEPOLIA_FORK_BLOCK", uint256(0));
        if (pin == 0) pin = resolvedLaunchpadBlock;
        if (pin == 0) pin = FORK_BLOCK;
        if (pin == 0) {
            vm.createSelectFork(rpc);
        } else {
            try this._forkAt(rpc, pin) {
            } catch {
                // Archive-less public RPCs reject old pins; latest still hits the live PoolManager.
                vm.createSelectFork(rpc);
            }
        }
        forked = true;
        return true;
    }

    function _resolveAndBind() internal {
        _peekDeploymentRecord();
        _readEnvFallback();
        if (_liveStackReady() && _canSignFor(resolvedLaunchpad)) {
            _bindLive();
            return;
        }
        _deployLocalOnFork();
    }

    /// Quote minus 1%. Caller must pass a quote large enough that this is non-zero.
    function _minOut(uint256 quoted) internal pure returns (uint256 minOut) {
        minOut = quoted * 99 / 100;
        require(minOut > 0, "1% slippage is zero");
    }

    function _register(address wallet, string memory label) internal {
        uint256 n = nextNullifier++;
        vm.prank(wallet);
        launchpad.registerProphet(
            label, n, signRegister(address(launchpad), wallet, n, block.chainid, signerPk)
        );
    }

    function _launchSlug(string memory slug) internal returns (address token) {
        vm.prank(prophet);
        token = launchpad.launch(slug, "a prophecy sentence", 1_800_000_000, 0);
    }

    function _graduateSlug(string memory slug) internal returns (address token) {
        token = _launchSlug(slug);
        _sellOut(token);
    }

    function _tryJsonAddress(string memory json, string memory key) internal view returns (address) {
        if (!vm.keyExistsJson(json, key)) return address(0);
        return vm.parseJsonAddress(json, key);
    }

    function _tryJsonUint(string memory json, string memory key) internal view returns (uint256) {
        if (!vm.keyExistsJson(json, key)) return 0;
        return vm.parseJsonUint(json, key);
    }

    function _hasCode(address addr) internal view returns (bool) {
        return addr != address(0) && addr.code.length > 0;
    }

    function _firstNonZero(address a, address b) internal pure returns (address) {
        return a != address(0) ? a : b;
    }

    /// Read json if present. Safe to call before the fork (file I/O only).
    function _peekDeploymentRecord() internal {
        if (resolvedLaunchpad != address(0) || resolvedLaunchpadBlock != 0) return;
        string memory json = _readDeploymentJson();
        if (bytes(json).length == 0) return;

        resolvedLaunchpad = _firstNonZero(_tryJsonAddress(json, ".launchpad"), _tryJsonAddress(json, ".contracts.Launchpad"));
        resolvedHook = _firstNonZero(_tryJsonAddress(json, ".hook"), _tryJsonAddress(json, ".contracts.ProphecyHook"));
        resolvedLocker = _firstNonZero(_tryJsonAddress(json, ".locker"), _tryJsonAddress(json, ".contracts.LiquidityLocker"));
        resolvedPoolManager =
            _firstNonZero(_tryJsonAddress(json, ".poolManager"), _tryJsonAddress(json, ".external.PoolManager"));
        resolvedAdapter = _tryJsonAddress(json, ".adapter");
        resolvedParentRegistry = _tryJsonAddress(json, ".parentUserRegistry");
        resolvedLaunchpadBlock = _tryJsonUint(json, ".launchpadBlock");
    }

    function _readDeploymentJson() internal view returns (string memory json) {
        if (vm.exists("deployments/sepolia.json")) {
            return vm.readFile("deployments/sepolia.json");
        }
        // Infra #30 may write the record at the repo root.
        try this._readOutsideContracts("deployments/sepolia.json") returns (string memory data) {
            return data;
        } catch {}
        try this._readOutsideContracts("../deployments/sepolia.json") returns (string memory data) {
            return data;
        } catch {}
    }

    function _forkAt(string memory rpc, uint256 pin) external {
        vm.createSelectFork(rpc, pin);
    }

    /// Isolated so a missing fs_permissions entry cannot abort setUp.
    function _readOutsideContracts(string memory path) external view returns (string memory) {
        if (!vm.exists(path)) revert();
        return vm.readFile(path);
    }

    function _envAddress(string memory name) internal view returns (address) {
        return vm.envOr(name, address(0));
    }

    function _readEnvFallback() internal {
        if (resolvedLaunchpad == address(0)) resolvedLaunchpad = _envAddress("PROPHECY_LAUNCHPAD");
        if (resolvedHook == address(0)) resolvedHook = _envAddress("PROPHECY_HOOK");
        if (resolvedLocker == address(0)) resolvedLocker = _envAddress("PROPHECY_LOCKER");
        if (resolvedAdapter == address(0)) resolvedAdapter = _envAddress("PROPHECY_ADAPTER");
        if (resolvedParentRegistry == address(0)) {
            resolvedParentRegistry = _envAddress("PROPHECY_PARENT_USER_REGISTRY");
        }
        if (resolvedPoolManager == address(0)) {
            resolvedPoolManager = _firstNonZero(_envAddress("POOL_MANAGER"), _envAddress("PROPHECY_POOL_MANAGER"));
        }
        if (resolvedPoolManager == address(0)) resolvedPoolManager = _envAddress("UNISWAP_V4_POOL_MANAGER");
    }

    function _fillFromLaunchpadViews(address pad) internal view returns (address h, address loc, address pm) {
        if (!_hasCode(pad)) return (address(0), address(0), address(0));
        h = address(Launchpad(payable(pad)).hook());
        loc = address(Launchpad(payable(pad)).locker());
        pm = address(Launchpad(payable(pad)).poolManager());
    }

    function _liveStackReady() internal view returns (bool) {
        if (!_hasCode(resolvedLaunchpad)) return false;
        (address h, address loc, address pm) = _fillFromLaunchpadViews(resolvedLaunchpad);
        address hook_ = _firstNonZero(resolvedHook, h);
        address locker_ = _firstNonZero(resolvedLocker, loc);
        address pm_ = _firstNonZero(resolvedPoolManager, pm);
        return _hasCode(hook_) && _hasCode(locker_) && _hasCode(pm_);
    }

    function _canSignFor(address pad) internal view returns (bool) {
        if (!_hasCode(pad)) return false;
        address ws = Launchpad(payable(pad)).worldSigner();
        if (ws == vm.addr(SIGNER_PK)) return true;
        if (!vm.envExists("WORLD_SIGNER_KEY")) return false;
        return vm.addr(vm.envUint("WORLD_SIGNER_KEY")) == ws;
    }

    function _bindLive() internal {
        launchpad = Launchpad(payable(resolvedLaunchpad));
        (address h, address loc, address pm) = _fillFromLaunchpadViews(resolvedLaunchpad);
        address hook_ = _firstNonZero(resolvedHook, h);
        address locker_ = _firstNonZero(resolvedLocker, loc);
        address pm_ = _firstNonZero(_firstNonZero(resolvedPoolManager, pm), SEPOLIA_POOL_MANAGER);

        hook = ProphecyHook(hook_);
        locker = LiquidityLocker(payable(locker_));
        manager = IPoolManager(pm_);
        protocol = launchpad.protocolFeeRecipient();
        signer = launchpad.worldSigner();
        if (signer == vm.addr(SIGNER_PK)) {
            signerPk = SIGNER_PK;
        } else {
            signerPk = vm.envUint("WORLD_SIGNER_KEY");
        }
    }

    /// Launchpad → Hook CREATE2 (flag bits) → Locker → `setUniswap` on the real
    /// Sepolia PoolManager. Prophet names use the same World-signer + ENS mocks
    /// as the in-memory tests so this file does not duplicate infra #30.
    function _deployLocalOnFork() internal {
        locallyDeployed = true;
        signer = vm.addr(SIGNER_PK);
        signerPk = SIGNER_PK;
        mockEns = new MockProphecyEns();
        launchpad = new Launchpad(protocol, signer, IProphecyEns(address(mockEns)));

        address pmAddr = resolvedPoolManager;
        if (!_hasCode(pmAddr)) pmAddr = SEPOLIA_POOL_MANAGER;
        require(_hasCode(pmAddr), "Sepolia PoolManager missing on this fork");

        IPoolManager pm = IPoolManager(pmAddr);
        bytes memory ctorArgs = abi.encode(pm, address(launchpad));
        (, bytes32 salt) =
            HookMiner.find(address(this), HookMiner.prophecyFlags(), type(ProphecyHook).creationCode, ctorArgs);
        ProphecyHook h = new ProphecyHook{salt: salt}(pm, address(launchpad));
        require(uint160(address(h)) & HookMiner.FLAG_MASK == HookMiner.prophecyFlags(), "hook flags");

        LiquidityLocker loc = new LiquidityLocker(pm, address(launchpad), IHooks(address(h)));
        launchpad.setUniswap(pm, address(h), address(loc));

        manager = pm;
        hook = h;
        locker = loc;
    }
}
