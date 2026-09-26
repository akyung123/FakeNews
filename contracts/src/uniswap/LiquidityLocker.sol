// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {IERC20Minimal} from "v4-core/src/interfaces/external/IERC20Minimal.sol";

import {Graduation} from "./Graduation.sol";

interface IPositionManagerLite {
    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable;
    function getPoolAndPositionInfo(uint256 tokenId) external view returns (PoolKey memory, uint256);
    function getPositionLiquidity(uint256 tokenId) external view returns (uint128);
    function ownerOf(uint256 tokenId) external view returns (address);
}

/// Holds v4 PositionManager LP NFTs. No path to take the principal out.
/// `collect` is per NFT: prophet 24, protocol 76. Multiple tokenIds per token
/// so a dust front-run cannot freeze the real position.
contract LiquidityLocker {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private constant DECREASE_LIQUIDITY = 0x01;
    uint256 private constant TAKE_PAIR = 0x11;

    IPoolManager public immutable poolManager;
    address public immutable launchpad;
    IHooks public immutable hook;
    IPositionManagerLite public positionManager;

    uint256 private _status = _NOT_ENTERED;

    struct Position {
        address prophet;
        address protocolFeeRecipient;
        bool prepared;
    }

    struct NftLock {
        Currency currency0;
        Currency currency1;
        bool registered;
    }

    mapping(address token => Position) public positions;
    mapping(address token => uint256[]) internal _tokenIds;
    mapping(address token => mapping(uint256 tokenId => NftLock)) internal _nfts;
    mapping(address prophet => uint256) public accruedEth;
    uint256 public totalAccruedEth;

    event Prepared(address indexed token, address indexed prophet, address indexed protocolFeeRecipient);
    event Registered(address indexed token, uint256 indexed tokenId);
    event PositionReceived(address indexed token, uint256 indexed tokenId);
    event Collected(
        address indexed token,
        uint256 indexed tokenId,
        uint256 prophetAmount0,
        uint256 protocolAmount0,
        uint256 prophetAmount1,
        uint256 protocolAmount1
    );
    event ProphetAccrued(address indexed prophet, uint256 amount);
    event ProphetWithdrawn(address indexed prophet, uint256 amount);
    event PositionManagerSet(address positionManager);

    error NotLaunchpad();
    error NotPositionManager();
    error ZeroAddress();
    error AlreadyPrepared();
    error AlreadyReceived();
    error UnknownLock();
    error PositionManagerAlreadySet();
    error PositionManagerNotSet();
    error BadPoolKey();
    error EthTransferFailed();
    error TokenTransferFailed();
    error Reentrant();
    error NothingAccrued();
    error UnexpectedEth();
    error NotNftOwner();

    modifier nonReentrant() {
        if (_status == _ENTERED) revert Reentrant();
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    constructor(IPoolManager poolManager_, address launchpad_, IHooks hook_) {
        if (address(poolManager_) == address(0) || launchpad_ == address(0) || address(hook_) == address(0)) {
            revert ZeroAddress();
        }
        poolManager = poolManager_;
        launchpad = launchpad_;
        hook = hook_;
    }

    receive() external payable {
        if (msg.sender != address(positionManager) && msg.sender != address(poolManager)) revert UnexpectedEth();
    }

    function setPositionManager(address positionManager_) external {
        if (msg.sender != launchpad) revert NotLaunchpad();
        if (address(positionManager) != address(0)) revert PositionManagerAlreadySet();
        if (positionManager_ == address(0)) revert ZeroAddress();
        positionManager = IPositionManagerLite(positionManager_);
        emit PositionManagerSet(positionManager_);
    }

    /// Recipients are fixed here. Called by Launchpad at issue, before migrate.
    function prepare(address token, address prophet, address protocolFeeRecipient) external {
        if (msg.sender != launchpad) revert NotLaunchpad();
        if (token == address(0) || prophet == address(0) || protocolFeeRecipient == address(0)) revert ZeroAddress();
        Position storage p = positions[token];
        if (p.prepared) revert AlreadyPrepared();
        p.prophet = prophet;
        p.protocolFeeRecipient = protocolFeeRecipient;
        p.prepared = true;
        emit Prepared(token, prophet, protocolFeeRecipient);
    }

    /// Official PositionManager `_mint` does not call `onERC721Received`. Anyone
    /// may bind an NFT the locker already owns after `prepare`. Multiple NFTs
    /// per token are allowed; the same tokenId cannot be bound twice.
    function register(address token, uint256 tokenId) external {
        if (token == address(0)) revert ZeroAddress();
        _register(token, tokenId);
    }

    function onERC721Received(address, address, uint256 tokenId, bytes calldata) external returns (bytes4) {
        if (msg.sender != address(positionManager)) revert NotPositionManager();
        (PoolKey memory key,) = positionManager.getPoolAndPositionInfo(tokenId);
        _register(Currency.unwrap(key.currency1), tokenId);
        return this.onERC721Received.selector;
    }

    function _register(address token, uint256 tokenId) internal {
        if (address(positionManager) == address(0)) revert PositionManagerNotSet();
        if (positionManager.ownerOf(tokenId) != address(this)) revert NotNftOwner();
        (PoolKey memory key,) = positionManager.getPoolAndPositionInfo(tokenId);
        if (
            Currency.unwrap(key.currency0) != address(0) || Currency.unwrap(key.currency1) != token
                || address(key.hooks) != address(hook) || key.fee != Graduation.POOL_FEE
                || key.tickSpacing != Graduation.TICK_SPACING
        ) {
            revert BadPoolKey();
        }
        Position storage p = positions[token];
        if (!p.prepared) revert UnknownLock();
        NftLock storage nft = _nfts[token][tokenId];
        if (nft.registered) revert AlreadyReceived();
        nft.currency0 = key.currency0;
        nft.currency1 = key.currency1;
        nft.registered = true;
        _tokenIds[token].push(tokenId);
        emit Registered(token, tokenId);
        emit PositionReceived(token, tokenId);
    }

    /// Anyone may call. Fees from this NFT go only to the two recipients stored at prepare.
    /// One tokenId per call — dust spam must not force a loop over every position.
    function collect(address token, uint256 tokenId) external nonReentrant {
        Position storage p = positions[token];
        if (!p.prepared) revert UnknownLock();
        NftLock storage nft = _nfts[token][tokenId];
        if (!nft.registered) revert UnknownLock();
        if (address(positionManager) == address(0)) revert PositionManagerNotSet();

        uint256 ethBefore = address(this).balance;
        uint256 tokBefore = IERC20Minimal(token).balanceOf(address(this));

        bytes memory actions = new bytes(2);
        actions[0] = bytes1(uint8(DECREASE_LIQUIDITY));
        actions[1] = bytes1(uint8(TAKE_PAIR));
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(tokenId, uint256(0), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(nft.currency0, nft.currency1, address(this));
        positionManager.modifyLiquidities(abi.encode(actions, params), block.timestamp);

        uint256 amount0 = address(this).balance - ethBefore;
        uint256 amount1 = IERC20Minimal(token).balanceOf(address(this)) - tokBefore;
        (uint256 prophet0, uint256 protocol0) = Graduation.splitFees(amount0);
        (uint256 prophet1, uint256 protocol1) = Graduation.splitFees(amount1);

        _pay(nft.currency0, p.protocolFeeRecipient, protocol0);
        _pay(nft.currency1, p.protocolFeeRecipient, protocol1);
        _payEthOrAccrue(p.prophet, prophet0);
        _pay(nft.currency1, p.prophet, prophet1);

        emit Collected(token, tokenId, prophet0, protocol0, prophet1, protocol1);
    }

    function withdrawAccrued() external nonReentrant {
        uint256 amount = accruedEth[msg.sender];
        if (amount == 0) revert NothingAccrued();
        accruedEth[msg.sender] = 0;
        totalAccruedEth -= amount;
        emit ProphetWithdrawn(msg.sender, amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert EthTransferFailed();
    }

    function tokenIdsOf(address token) external view returns (uint256[] memory) {
        return _tokenIds[token];
    }

    function isRegistered(address token, uint256 tokenId) external view returns (bool) {
        return _nfts[token][tokenId].registered;
    }

    /// Prophet stored at `prepare`. There is no `prophetOf(uint256 tokenId)`.
    function prophetOf(address token) external view returns (address) {
        if (!positions[token].prepared) revert UnknownLock();
        return positions[token].prophet;
    }

    function _pay(Currency currency, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (currency.isAddressZero()) {
            (bool ok,) = to.call{value: amount}("");
            if (!ok) revert EthTransferFailed();
        } else if (!IERC20Minimal(Currency.unwrap(currency)).transfer(to, amount)) {
            revert TokenTransferFailed();
        }
    }

    function _payEthOrAccrue(address prophet, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok,) = prophet.call{value: amount}("");
        if (!ok) {
            accruedEth[prophet] += amount;
            totalAccruedEth += amount;
            emit ProphetAccrued(prophet, amount);
        }
    }
}
