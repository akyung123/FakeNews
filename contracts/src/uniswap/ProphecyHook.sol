// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";

/// V4 hook: `beforeInitialize` allows only the Launchpad.
/// Deploy with a mined CREATE2 salt so the address bits match `getHookPermissions`.
contract ProphecyHook {
    IPoolManager public immutable poolManager;
    address public immutable launchpad;

    error NotPoolManager();
    error NotLaunchpad();
    error ZeroAddress();

    constructor(IPoolManager poolManager_, address launchpad_) {
        if (address(poolManager_) == address(0) || launchpad_ == address(0)) revert ZeroAddress();
        poolManager = poolManager_;
        launchpad = launchpad_;
        Hooks.validateHookPermissions(IHooks(address(this)), getHookPermissions());
    }

    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: false,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function beforeInitialize(address sender, PoolKey calldata, uint160) external view returns (bytes4) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        if (sender != launchpad) revert NotLaunchpad();
        return IHooks.beforeInitialize.selector;
    }
}
