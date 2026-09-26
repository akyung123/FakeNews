// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";

import {IInitializerHook} from "./IInitializerHook.sol";

/// Official InitializerHook pattern so LBPStrategy can initialize the v4 pool.
/// Constructor ABI stays `(poolManager, authorized)` — pass LBPStrategy.
/// https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/periphery/hooks/InitializerHook.sol
contract ProphecyHook is IInitializerHook {
    bytes4 private constant _IERC165_ID = 0x01ffc9a7;

    IPoolManager public immutable poolManager;
    address public immutable authorized;

    error NotPoolManager();
    error InvalidInitializer(address caller, address expected);
    error ZeroAddress();

    constructor(IPoolManager poolManager_, address authorized_) {
        if (address(poolManager_) == address(0) || authorized_ == address(0)) revert ZeroAddress();
        poolManager = poolManager_;
        authorized = authorized_;
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

    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return interfaceId == type(IInitializerHook).interfaceId || interfaceId == _IERC165_ID;
    }

    function beforeInitialize(address sender, PoolKey calldata, uint160) external view returns (bytes4) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        if (sender != authorized) revert InvalidInitializer(sender, authorized);
        return IHooks.beforeInitialize.selector;
    }
}
