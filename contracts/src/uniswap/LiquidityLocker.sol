// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {IERC20Minimal} from "v4-core/src/interfaces/external/IERC20Minimal.sol";
import {CurrencySettler} from "v4-core/test/utils/CurrencySettler.sol";

import {Graduation} from "./Graduation.sol";

/// Holds a full-range V4 position with no path to take the principal out.
/// `collect` sends accrued pool fees only: prophet 24, protocol 76.
contract LiquidityLocker is IUnlockCallback {
    using CurrencySettler for Currency;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    IPoolManager public immutable poolManager;
    address public immutable launchpad;

    struct Position {
        Currency currency0;
        Currency currency1;
        uint24 fee;
        int24 tickSpacing;
        IHooks hooks;
        int24 tickLower;
        int24 tickUpper;
        bytes32 salt;
        address prophet;
        address protocolFeeRecipient;
        bool locked;
    }

    mapping(address token => Position) public positions;

    event Locked(address indexed token, address indexed prophet, address indexed protocolFeeRecipient, uint128 liquidity);
    event Collected(
        address indexed token,
        uint256 prophetAmount0,
        uint256 protocolAmount0,
        uint256 prophetAmount1,
        uint256 protocolAmount1
    );

    error NotPoolManager();
    error NotLaunchpad();
    error ZeroAddress();
    error AlreadyLocked();
    error UnknownLock();
    error BadPoolKey();
    error ZeroLiquidity();
    error UnexpectedDebt();
    error EthTransferFailed();
    error TokenTransferFailed();

    constructor(IPoolManager poolManager_, address launchpad_) {
        if (address(poolManager_) == address(0) || launchpad_ == address(0)) revert ZeroAddress();
        poolManager = poolManager_;
        launchpad = launchpad_;
    }

    receive() external payable {}

    /// Seed full-range liquidity. Recipients are fixed here and cannot change.
    /// The pool must already be initialized by the Launchpad.
    function lock(
        address token,
        address prophet,
        address protocolFeeRecipient,
        PoolKey calldata key,
        uint256 tokenAmount
    ) external payable {
        if (msg.sender != launchpad) revert NotLaunchpad();
        if (token == address(0) || prophet == address(0) || protocolFeeRecipient == address(0)) revert ZeroAddress();
        Position storage p = positions[token];
        if (p.locked) revert AlreadyLocked();
        if (
            Currency.unwrap(key.currency0) != address(0) || Currency.unwrap(key.currency1) != token
                || key.fee != Graduation.POOL_FEE || key.tickSpacing != Graduation.TICK_SPACING
        ) revert BadPoolKey();

        p.currency0 = key.currency0;
        p.currency1 = key.currency1;
        p.fee = key.fee;
        p.tickSpacing = key.tickSpacing;
        p.hooks = key.hooks;
        p.tickLower = Graduation.tickLower();
        p.tickUpper = Graduation.tickUpper();
        p.salt = bytes32(0);
        p.prophet = prophet;
        p.protocolFeeRecipient = protocolFeeRecipient;
        p.locked = true;

        if (tokenAmount > 0) {
            if (!IERC20Minimal(token).transferFrom(msg.sender, address(this), tokenAmount)) {
                revert TokenTransferFailed();
            }
        }

        poolManager.unlock(abi.encode(true, token, msg.sender));
    }

    /// Anyone may call. Fees go only to the two recipients stored at lock time.
    function collect(address token) external {
        Position storage p = positions[token];
        if (!p.locked) revert UnknownLock();
        poolManager.unlock(abi.encode(false, token, address(0)));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        (bool isLock, address token, address refundTo) = abi.decode(data, (bool, address, address));
        if (isLock) {
            _addLiquidity(token, refundTo);
        } else {
            _collectFees(token);
        }
        return "";
    }

    function _poolKey(Position storage p) internal view returns (PoolKey memory) {
        return PoolKey({
            currency0: p.currency0,
            currency1: p.currency1,
            fee: p.fee,
            tickSpacing: p.tickSpacing,
            hooks: p.hooks
        });
    }

    function _addLiquidity(address token, address refundTo) internal {
        Position storage p = positions[token];
        PoolKey memory key = _poolKey(p);
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(key.toId());

        uint256 amount0 = address(this).balance;
        uint256 amount1 = IERC20Minimal(token).balanceOf(address(this));
        uint128 liquidity = Graduation.fullRangeLiquidity(sqrtPriceX96, amount0, amount1);
        if (liquidity == 0) revert ZeroLiquidity();

        (BalanceDelta delta,) = poolManager.modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({
                tickLower: p.tickLower,
                tickUpper: p.tickUpper,
                liquidityDelta: int256(uint256(liquidity)),
                salt: p.salt
            }),
            ""
        );

        _settleDelta(key, delta);
        _refund(token, refundTo);
        emit Locked(token, p.prophet, p.protocolFeeRecipient, liquidity);
    }

    function _collectFees(address token) internal {
        Position storage p = positions[token];
        PoolKey memory key = _poolKey(p);

        (BalanceDelta delta,) = poolManager.modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({
                tickLower: p.tickLower,
                tickUpper: p.tickUpper,
                liquidityDelta: 0,
                salt: p.salt
            }),
            ""
        );

        int128 d0 = delta.amount0();
        int128 d1 = delta.amount1();
        if (d0 < 0 || d1 < 0) revert UnexpectedDebt();

        (uint256 prophet0, uint256 protocol0) = Graduation.splitFees(uint256(uint128(d0)));
        (uint256 prophet1, uint256 protocol1) = Graduation.splitFees(uint256(uint128(d1)));

        if (prophet0 > 0) key.currency0.take(poolManager, p.prophet, prophet0, false);
        if (protocol0 > 0) key.currency0.take(poolManager, p.protocolFeeRecipient, protocol0, false);
        if (prophet1 > 0) key.currency1.take(poolManager, p.prophet, prophet1, false);
        if (protocol1 > 0) key.currency1.take(poolManager, p.protocolFeeRecipient, protocol1, false);

        emit Collected(token, prophet0, protocol0, prophet1, protocol1);
    }

    function _settleDelta(PoolKey memory key, BalanceDelta delta) internal {
        int128 d0 = delta.amount0();
        int128 d1 = delta.amount1();
        if (d0 < 0) key.currency0.settle(poolManager, address(this), uint256(uint128(-d0)), false);
        if (d1 < 0) key.currency1.settle(poolManager, address(this), uint256(uint128(-d1)), false);
        if (d0 > 0) key.currency0.take(poolManager, address(this), uint256(uint128(d0)), false);
        if (d1 > 0) key.currency1.take(poolManager, address(this), uint256(uint128(d1)), false);
    }

    function _refund(address token, address to) internal {
        uint256 ethBal = address(this).balance;
        if (ethBal > 0) {
            (bool ok,) = to.call{value: ethBal}("");
            if (!ok) revert EthTransferFailed();
        }
        uint256 tokBal = IERC20Minimal(token).balanceOf(address(this));
        if (tokBal > 0) {
            if (!IERC20Minimal(token).transfer(to, tokBal)) revert TokenTransferFailed();
        }
    }
}
