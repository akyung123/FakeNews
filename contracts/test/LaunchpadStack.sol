// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";

import {Launchpad} from "../src/Launchpad.sol";
import {ProphecyHook} from "../src/uniswap/ProphecyHook.sol";
import {HookMiner} from "../src/uniswap/HookMiner.sol";
import {LiquidityLocker} from "../src/uniswap/LiquidityLocker.sol";

/// Shared deploy: Launchpad, Hook (CREATE2 with the Launchpad address),
/// Locker, then a one-time `setUniswap` from the deployer (this test).
contract LaunchpadStack is Test {
    IPoolManager internal manager;
    ProphecyHook internal hook;
    LiquidityLocker internal locker;
    Launchpad internal launchpad;

    function _deployStack(address protocol, address signer) internal {
        launchpad = _newStack(protocol, signer);
    }

    function _newStack(address protocol, address signer) internal returns (Launchpad pad) {
        IPoolManager pm = new PoolManager(address(this));
        pad = new Launchpad(protocol, signer);
        bytes memory ctorArgs = abi.encode(pm, address(pad));
        (, bytes32 salt) =
            HookMiner.find(address(this), HookMiner.prophecyFlags(), type(ProphecyHook).creationCode, ctorArgs);
        ProphecyHook h = new ProphecyHook{salt: salt}(pm, address(pad));
        LiquidityLocker loc = new LiquidityLocker(pm, address(pad), IHooks(address(h)));
        pad.setUniswap(pm, address(h), address(loc));
        require(h.launchpad() == address(pad), "hook launchpad");
        require(loc.launchpad() == address(pad), "locker launchpad");
        manager = pm;
        hook = h;
        locker = loc;
        launchpad = pad;
    }
}
