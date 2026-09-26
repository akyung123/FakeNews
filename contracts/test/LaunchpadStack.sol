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

/// Shared CREATE-prediction deploy used by curve and graduation tests.
/// Hook constructor needs the Launchpad address; Launchpad constructor needs
/// the hook. CREATE of Launchpad does not hash constructor args, so we predict
/// it from the deployer nonce after the hook CREATE2 and locker CREATE.
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
        uint64 nonce = vm.getNonce(address(this));
        address predicted = vm.computeCreateAddress(address(this), nonce + 2);
        bytes memory ctorArgs = abi.encode(pm, predicted);
        (, bytes32 salt) =
            HookMiner.find(address(this), HookMiner.prophecyFlags(), type(ProphecyHook).creationCode, ctorArgs);
        ProphecyHook h = new ProphecyHook{salt: salt}(pm, predicted);
        LiquidityLocker loc = new LiquidityLocker(pm, predicted, IHooks(address(h)));
        pad = new Launchpad(protocol, signer, pm, IHooks(address(h)), loc);
        require(address(pad) == predicted, "CREATE mismatch");
        require(h.launchpad() == address(pad), "hook launchpad");
        require(loc.launchpad() == address(pad), "locker launchpad");
        manager = pm;
        hook = h;
        locker = loc;
        launchpad = pad;
    }
}
