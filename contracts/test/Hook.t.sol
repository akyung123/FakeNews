// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {PoolIdLibrary} from "v4-core/src/types/PoolId.sol";

import {ProphecyToken} from "../src/ProphecyToken.sol";
import {ProphecyHook} from "../src/uniswap/ProphecyHook.sol";
import {HookMiner} from "../src/uniswap/HookMiner.sol";
import {Graduation} from "../src/uniswap/Graduation.sol";

contract HookTest is Test {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    IPoolManager internal manager;
    ProphecyHook internal hook;
    address internal token;
    PoolKey internal key;

    function setUp() public {
        manager = new PoolManager(address(this));
        token = address(new ProphecyToken("lingo-2028.prophecy.eth", "LINGO-2028", address(this)));

        bytes memory ctorArgs = abi.encode(manager, address(this));
        (address predicted, bytes32 salt) =
            HookMiner.find(address(this), HookMiner.prophecyFlags(), type(ProphecyHook).creationCode, ctorArgs);
        hook = new ProphecyHook{salt: salt}(manager, address(this));
        require(address(hook) == predicted, "CREATE2 mismatch");

        key = Graduation.poolKey(token, IHooks(address(hook)));
    }

    function test_deploysAtFlaggedCreate2Address() public view {
        assertEq(uint160(address(hook)) & HookMiner.FLAG_MASK, HookMiner.prophecyFlags());
        assertTrue(hook.getHookPermissions().beforeInitialize);
        assertFalse(hook.getHookPermissions().afterSwap);
        assertEq(hook.launchpad(), address(this));
        assertEq(address(hook.poolManager()), address(manager));
    }

    function test_constructorRevertsWhenFlagsDoNotMatch() public {
        vm.expectRevert();
        new ProphecyHook(manager, address(this));
    }

    function test_beforeInitializeAllowsLaunchpad() public {
        uint160 sqrtP = Graduation.sqrtPriceX96FromVirtualReserves(1 ether, 1_000_000e18);
        manager.initialize(key, sqrtP);
        (uint160 stored,,,) = manager.getSlot0(key.toId());
        assertEq(stored, sqrtP);
    }

    function test_beforeInitializeRevertsForOtherCaller() public {
        uint160 sqrtP = Graduation.sqrtPriceX96FromVirtualReserves(1 ether, 1_000_000e18);
        address other = address(0xB0B);
        vm.prank(other);
        vm.expectRevert();
        manager.initialize(key, sqrtP);
    }

    function test_beforeInitializeRejectsDirectCall() public {
        vm.expectRevert(ProphecyHook.NotPoolManager.selector);
        hook.beforeInitialize(address(this), key, 0);
    }
}
