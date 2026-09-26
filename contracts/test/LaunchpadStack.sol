// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";

import {IProphecyEns} from "../src/ens/IProphecyEns.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {ProphecyHook} from "../src/uniswap/ProphecyHook.sol";
import {HookMiner} from "../src/uniswap/HookMiner.sol";
import {LiquidityLocker} from "../src/uniswap/LiquidityLocker.sol";
import {LaunchpadTestBase, MockProphecyEns} from "./LaunchpadHelpers.sol";
import {MockLBPStrategy, MockPositionManager} from "./mocks/MockCca.sol";

/// Launchpad, Hook CREATE2 (authorized = mock LBP), Locker, setUniswap, setCca.
contract LaunchpadStack is LaunchpadTestBase {
    IPoolManager internal manager;
    ProphecyHook internal hook;
    LiquidityLocker internal locker;

    function _deployStack() internal {
        signer = vm.addr(SIGNER_PK);
        mockEns = new MockProphecyEns();
        launchpad = new Launchpad(protocol, signer, IProphecyEns(address(mockEns)));
        _wireUniswap(launchpad);
    }

    function _newStack(address protocol_, address signer_) internal returns (Launchpad pad) {
        pad = new Launchpad(protocol_, signer_, IProphecyEns(address(new MockProphecyEns())));
        _wireUniswap(pad);
        return pad;
    }

    function _wireUniswap(Launchpad pad) internal {
        mockStrategy = new MockLBPStrategy();
        mockPosm = new MockPositionManager();
        IPoolManager pm = new PoolManager(address(this));
        bytes memory ctorArgs = abi.encode(pm, address(mockStrategy));
        (, bytes32 salt) =
            HookMiner.find(address(this), HookMiner.prophecyFlags(), type(ProphecyHook).creationCode, ctorArgs);
        ProphecyHook h = new ProphecyHook{salt: salt}(pm, address(mockStrategy));
        LiquidityLocker loc = new LiquidityLocker(pm, address(pad), IHooks(address(h)));
        pad.setUniswap(pm, address(h), address(loc));
        pad.setCca(address(mockStrategy), address(mockPosm));
        assertEq(address(pad.poolManager()), address(pm));
        assertEq(address(pad.hook()), address(h));
        assertEq(address(pad.locker()), address(loc));
        assertEq(address(pad.lbpStrategy()), address(mockStrategy));
        manager = pm;
        hook = h;
        locker = loc;
        mockLocker = loc;
    }
}
