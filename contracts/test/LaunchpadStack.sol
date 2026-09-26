// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";

import {Launchpad} from "../src/Launchpad.sol";
import {ProphecyHook} from "../src/uniswap/ProphecyHook.sol";
import {HookMiner} from "../src/uniswap/HookMiner.sol";
import {LiquidityLocker} from "../src/uniswap/LiquidityLocker.sol";
import {LaunchpadTestBase} from "./LaunchpadHelpers.sol";

/// Launchpad (with ENS), Hook CREATE2, Locker, then deployer `setUniswap` once.
contract LaunchpadStack is LaunchpadTestBase {
    IPoolManager internal manager;
    ProphecyHook internal hook;
    LiquidityLocker internal locker;

    function _deployStack() internal {
        _deployLaunchpad();
        _wireUniswap(launchpad);
    }

    function _newStack(address protocol_, address signer_) internal returns (Launchpad pad) {
        pad = _newLaunchpad(protocol_, signer_);
        _wireUniswap(pad);
    }

    function _wireUniswap(Launchpad pad) internal {
        IPoolManager pm = new PoolManager(address(this));
        bytes memory ctorArgs = abi.encode(pm, address(pad));
        (, bytes32 salt) =
            HookMiner.find(address(this), HookMiner.prophecyFlags(), type(ProphecyHook).creationCode, ctorArgs);
        ProphecyHook h = new ProphecyHook{salt: salt}(pm, address(pad));
        LiquidityLocker loc = new LiquidityLocker(pm, address(pad), IHooks(address(h)));
        pad.setUniswap(pm, address(h), address(loc));
        assertEq(address(pad.poolManager()), address(pm));
        assertEq(address(pad.hook()), address(h));
        assertEq(address(pad.locker()), address(loc));
        manager = pm;
        hook = h;
        locker = loc;
    }

    /// registerProphet → launch → sell out the curve → graduate.
    function _registerLaunchAndGraduate() internal returns (address token) {
        token = _registerAndLaunch();
        _sellOut(token);
    }
}
