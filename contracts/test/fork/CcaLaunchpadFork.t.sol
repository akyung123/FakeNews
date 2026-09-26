// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";

import {CcaLib} from "../../src/cca/CcaLib.sol";
import {IPositionManager} from "../../src/cca/IPositionManager.sol";
import {IProphecyEns} from "../../src/ens/IProphecyEns.sol";
import {Launchpad} from "../../src/Launchpad.sol";
import {ProphecyToken} from "../../src/ProphecyToken.sol";
import {Graduation} from "../../src/uniswap/Graduation.sol";
import {HookMiner} from "../../src/uniswap/HookMiner.sol";
import {LiquidityLocker} from "../../src/uniswap/LiquidityLocker.sol";
import {ProphecyHook} from "../../src/uniswap/ProphecyHook.sol";
import {MockProphecyEns} from "../LaunchpadHelpers.sol";
import {
    CcaSepoliaForkBase,
    ICcaFork,
    IUniversalRouter,
    CCA_FACTORY,
    LBP_STRATEGY,
    SEPOLIA_POOL_MANAGER,
    SEPOLIA_POSITION_MANAGER,
    SEPOLIA_UNIVERSAL_ROUTER
} from "./CcaSepoliaForkHelpers.sol";

/// Launchpad + ProphecyHook + LiquidityLocker against live Sepolia LBP / PositionManager.
/// Skips when the RPC has no official LBP/CCA code.
contract CcaLaunchpadForkTest is CcaSepoliaForkBase {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    uint256 internal constant SIGNER_PK =
        0x51C51C51C51C51C51C51C51C51C51C51C51C51C51C51C51C51C51C51C51C51C5;

    uint8 internal constant V4_SWAP = 0x10;
    uint8 internal constant SWAP_EXACT_IN_SINGLE = 0x06;
    uint8 internal constant SETTLE_ALL = 0x0c;
    uint8 internal constant TAKE_ALL = 0x0f;

    address internal prophet = address(0xA11CE);
    address internal signer;

    Launchpad internal pad;
    ProphecyHook internal prophecyHook;
    LiquidityLocker internal locker;
    MockProphecyEns internal mockEns;

    struct ExactInputSingle6 {
        PoolKey poolKey;
        bool zeroForOne;
        uint128 amountIn;
        uint128 amountOutMinimum;
        uint256 minHopPriceX36;
        bytes hookData;
    }

    function setUp() public {
        if (!_maybeFork()) return;
        try this._assertForkWiring() {
            signer = vm.addr(SIGNER_PK);
            vm.deal(protocol, 0);
            vm.deal(prophet, 1 ether);
        } catch {
            forked = false;
        }
    }

    function _assertForkWiring() external view {
        assertEq(strategy.initializerFactory(), CCA_FACTORY);
        assertEq(strategy.positionManager(), SEPOLIA_POSITION_MANAGER);
        assertEq(strategy.poolManager(), SEPOLIA_POOL_MANAGER);
    }

    /// Ours: Launchpad.launch → official LBP migrate → locker.register → swap → collect 24:76.
    function test_launchpadHookLockerMigrateRegisterCollect() public onFork {
        _deployOurStack();
        pad.setAuctionBlocks(10);

        uint256 n = 1;
        bytes32 digest = keccak256(abi.encode(block.chainid, address(pad), prophet, n));
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(SIGNER_PK, keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)));
        vm.prank(prophet);
        pad.registerProphet("ringo", n, abi.encodePacked(r, s, v));

        vm.prank(prophet);
        address token = pad.launch("lingo-2028", "a prophecy sentence", 1_800_000_000);
        address auctionAddr = pad.auctionOf(token);
        assertTrue(auctionAddr.code.length > 0, "auction");
        ICcaFork auction = ICcaFork(auctionAddr);
        assertEq(address(pad.hook()), address(prophecyHook));
        assertEq(address(pad.locker()), address(locker));
        assertEq(address(pad.lbpStrategy()), LBP_STRATEGY);
        assertEq(IInitializerHookAuth(address(prophecyHook)).authorized(), LBP_STRATEGY);

        uint256 id = _bid(auction, 0.021 ether, CcaLib.FLOOR_PRICE_Q96 * 2);
        _rollTo(auction.endBlock());
        vm.prank(bidder);
        auction.exitBid(id);
        _rollTo(auction.claimBlock());
        auction.claimTokens(id);
        assertTrue(auction.isGraduated());
        assertTrue(pad.isGraduated(token));

        vm.prank(protocol);
        auction.sweepUnsoldTokens();
        _rollTo(auction.endBlock() + 1);

        vm.recordLogs();
        strategy.migrate(auctionAddr);
        uint256 tokenId = _lpTokenIdFromLogs(address(locker));
        assertEq(IPositionManager(SEPOLIA_POSITION_MANAGER).ownerOf(tokenId), address(locker));

        locker.register(token, tokenId);
        assertTrue(locker.isRegistered(token, tokenId));
        assertEq(locker.prophetOf(token), prophet);
        uint256[] memory ids = locker.tokenIdsOf(token);
        assertEq(ids.length, 1);
        assertEq(ids[0], tokenId);

        PoolKey memory key = _poolKeyOurs(token);
        (uint160 sqrtP,,,) = IPoolManager(SEPOLIA_POOL_MANAGER).getSlot0(key.toId());
        assertGt(uint256(sqrtP), 0, "pool opened with our hook");

        address trader = address(0x5A0);
        vm.deal(trader, 1 ether);
        uint256 tokBefore = ProphecyToken(token).balanceOf(trader);
        _urBuy(trader, key, 0.001 ether);
        uint256 bought = ProphecyToken(token).balanceOf(trader) - tokBefore;
        assertGt(bought, 0, "swap");

        uint256 protoBefore = protocol.balance;
        uint256 prophetBefore = prophet.balance;
        locker.collect(token, tokenId);
        uint256 protoGain = protocol.balance - protoBefore;
        uint256 prophetGain = prophet.balance - prophetBefore;
        uint256 totalFee = protoGain + prophetGain;
        assertGt(totalFee, 0, "collect fees");
        (uint256 expProphet, uint256 expProtocol) = Graduation.splitFees(totalFee);
        assertEq(prophetGain, expProphet, "prophet 24");
        assertEq(protoGain, expProtocol, "protocol 76");
    }

    function _deployOurStack() internal {
        mockEns = new MockProphecyEns();
        pad = new Launchpad(protocol, signer, IProphecyEns(address(mockEns)));
        bytes memory ctorArgs = abi.encode(IPoolManager(SEPOLIA_POOL_MANAGER), LBP_STRATEGY);
        (, bytes32 salt) =
            HookMiner.find(address(this), HookMiner.prophecyFlags(), type(ProphecyHook).creationCode, ctorArgs);
        prophecyHook = new ProphecyHook{salt: salt}(IPoolManager(SEPOLIA_POOL_MANAGER), LBP_STRATEGY);
        locker = new LiquidityLocker(IPoolManager(SEPOLIA_POOL_MANAGER), address(pad), IHooks(address(prophecyHook)));
        pad.setUniswap(IPoolManager(SEPOLIA_POOL_MANAGER), address(prophecyHook), address(locker));
        pad.setCca(LBP_STRATEGY, SEPOLIA_POSITION_MANAGER);
    }

    function _poolKeyOurs(address token) internal view returns (PoolKey memory) {
        return PoolKey({
            currency0: CurrencyLibrary.ADDRESS_ZERO,
            currency1: Currency.wrap(token),
            fee: CcaLib.POOL_FEE,
            tickSpacing: CcaLib.POOL_TICK_SPACING,
            hooks: IHooks(address(prophecyHook))
        });
    }

    function _lpTokenIdFromLogs(address to) internal returns (uint256 tokenId) {
        bytes32 topic = keccak256("Transfer(address,address,uint256)");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != SEPOLIA_POSITION_MANAGER || logs[i].topics.length < 4) continue;
            if (logs[i].topics[0] != topic) continue;
            if (address(uint160(uint256(logs[i].topics[1]))) != address(0)) continue;
            if (address(uint160(uint256(logs[i].topics[2]))) != to) continue;
            return uint256(logs[i].topics[3]);
        }
        revert("PositionManager Transfer(0, locker, tokenId) not found");
    }

    function _urBuy(address trader, PoolKey memory key, uint128 amountIn) internal {
        bytes memory commands = abi.encodePacked(V4_SWAP);
        bytes memory actions = abi.encodePacked(SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL);
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            ExactInputSingle6({
                poolKey: key,
                zeroForOne: true,
                amountIn: amountIn,
                amountOutMinimum: 0,
                minHopPriceX36: 0,
                hookData: ""
            })
        );
        params[1] = abi.encode(key.currency0, amountIn);
        params[2] = abi.encode(key.currency1, uint128(0));
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(actions, params);
        vm.prank(trader);
        IUniversalRouter(SEPOLIA_UNIVERSAL_ROUTER).execute{value: amountIn}(commands, inputs, block.timestamp + 60);
    }
}

interface IInitializerHookAuth {
    function authorized() external view returns (address);
}
