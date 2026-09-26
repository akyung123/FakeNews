// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";

import {IProphecyEns} from "./ens/IProphecyEns.sol";
import {ProphecyToken} from "./ProphecyToken.sol";
import {LiquidityLocker} from "./uniswap/LiquidityLocker.sol";
import {CcaLib} from "./cca/CcaLib.sol";
import {MigratorParameters} from "./cca/CcaTypes.sol";
import {ICca, IDistributorFactory, ILBPStrategy} from "./cca/ICca.sol";

/// CCA launchpad. `launch` mints the token and starts an official LBPStrategy auction.
/// Constructor is (protocolFeeRecipient, worldSigner, ens). Uniswap + CCA addresses
/// are set once by the deployer. Deploy: Launchpad, Hook (CREATE2), Locker,
/// `setUniswap`, then `setCca`. Auction length is `auctionBlocks` (default 25).
contract Launchpad {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status = _NOT_ENTERED;

    uint256 public constant TOTAL_SUPPLY = CcaLib.TOTAL_SUPPLY;
    uint256 public constant AUCTION_SUPPLY = CcaLib.AUCTION_SUPPLY;
    uint256 public constant LP_SUPPLY = CcaLib.LP_SUPPLY;
    uint128 public constant REQUIRED_CURRENCY_RAISED = CcaLib.REQUIRED_CURRENCY_RAISED;
    uint24 public constant POOL_FEE = CcaLib.POOL_FEE;
    int24 public constant POOL_TICK_SPACING = CcaLib.POOL_TICK_SPACING;
    uint64 public constant DEFAULT_AUCTION_BLOCKS = CcaLib.DEFAULT_AUCTION_BLOCKS;

    mapping(uint256 nullifier => bool) internal _nullifierUsed;
    mapping(bytes32 labelHash => bool) internal _labelTaken;
    mapping(address wallet => string) internal _prophetOf;
    mapping(bytes32 slugKey => bool) internal _slugTaken;
    mapping(address token => address) internal _auctionOf;

    address public immutable protocolFeeRecipient;
    address public immutable worldSigner;
    address public immutable deployer;
    IProphecyEns public immutable ens;
    IPoolManager public poolManager;
    IHooks public hook;
    LiquidityLocker public locker;
    ILBPStrategy public lbpStrategy;
    address public positionManager;
    uint64 public auctionBlocks = DEFAULT_AUCTION_BLOCKS;

    event ProphetRegistered(address indexed wallet, string label, uint256 nullifier);
    event Launched(
        address indexed token, address indexed prophet, address indexed auction, string prophetLabel, string slug
    );
    event UniswapSet(address poolManager, address hook, address locker);
    event CcaSet(address lbpStrategy, address positionManager);
    event AuctionBlocksSet(uint64 auctionBlocks);

    error BadSlug();
    error BadLabel();
    error BadProphecy();
    error InvalidSignature();
    error NullifierUsed();
    error LabelTaken();
    error AlreadyProphet();
    error NotProphet();
    error SlugTaken();
    error EthTransferFailed();
    error ZeroAddress();
    error Reentrant();
    error TokenTransferFailed();
    error UnexpectedEth();
    error NotDeployer();
    error UniswapAlreadySet();
    error UniswapNotSet();
    error CcaAlreadySet();
    error CcaNotSet();
    error BadAuctionBlocks();
    error AuctionExists();
    error ProphetRecipient();
    error AuctionNotCreated();

    modifier nonReentrant() {
        if (_status == _ENTERED) revert Reentrant();
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    constructor(address protocolFeeRecipient_, address worldSigner_, IProphecyEns ens_) {
        if (protocolFeeRecipient_ == address(0) || worldSigner_ == address(0) || address(ens_) == address(0)) {
            revert ZeroAddress();
        }
        protocolFeeRecipient = protocolFeeRecipient_;
        worldSigner = worldSigner_;
        ens = ens_;
        deployer = msg.sender;
    }

    function setUniswap(IPoolManager poolManager_, address hook_, address locker_) external {
        if (msg.sender != deployer) revert NotDeployer();
        if (address(poolManager) != address(0) || address(hook) != address(0) || address(locker) != address(0)) {
            revert UniswapAlreadySet();
        }
        if (address(poolManager_) == address(0) || hook_ == address(0) || locker_ == address(0)) revert ZeroAddress();
        poolManager = poolManager_;
        hook = IHooks(hook_);
        locker = LiquidityLocker(payable(locker_));
        emit UniswapSet(address(poolManager_), hook_, locker_);
    }

    function setCca(address lbpStrategy_, address positionManager_) external {
        if (msg.sender != deployer) revert NotDeployer();
        if (address(lbpStrategy) != address(0) || positionManager != address(0)) revert CcaAlreadySet();
        if (lbpStrategy_ == address(0) || positionManager_ == address(0)) revert ZeroAddress();
        if (address(locker) == address(0)) revert UniswapNotSet();
        lbpStrategy = ILBPStrategy(lbpStrategy_);
        positionManager = positionManager_;
        locker.setPositionManager(positionManager_);
        emit CcaSet(lbpStrategy_, positionManager_);
    }

    function setAuctionBlocks(uint64 auctionBlocks_) external {
        if (msg.sender != deployer) revert NotDeployer();
        if (auctionBlocks_ == 0) revert BadAuctionBlocks();
        CcaLib.packSteps(auctionBlocks_);
        auctionBlocks = auctionBlocks_;
        emit AuctionBlocksSet(auctionBlocks_);
    }

    receive() external payable {
        if (
            msg.sender != address(locker) && msg.sender != address(poolManager) && msg.sender != address(lbpStrategy)
        ) revert UnexpectedEth();
    }

    /// World ID server signs `keccak256(abi.encode(chainId, launchpad, wallet, nullifier))`
    /// with EIP-191 (`world/src/encode.ts`). One nullifier, one prophet name.
    function registerProphet(string calldata label, uint256 nullifier, bytes calldata serverSig)
        external
        nonReentrant
    {
        _requireProphetLabel(label);
        if (_nullifierUsed[nullifier]) revert NullifierUsed();
        if (bytes(_prophetOf[msg.sender]).length != 0) revert AlreadyProphet();
        if (_labelTaken[keccak256(bytes(label))]) revert LabelTaken();
        _verifyWorldSig(nullifier, serverSig);

        _nullifierUsed[nullifier] = true;
        _labelTaken[keccak256(bytes(label))] = true;
        _prophetOf[msg.sender] = label;

        ens.registerProphet(label, msg.sender);
        emit ProphetRegistered(msg.sender, label, nullifier);
    }

    /// Mints the token and starts the CCA via official LBPStrategy.
    /// `prophecy` and `deadline` are written only into the prophecy resolver.
    function launch(string calldata slug, string calldata prophecy, uint64 deadline)
        external
        nonReentrant
        returns (address token)
    {
        if (address(lbpStrategy) == address(0) || address(hook) == address(0) || address(locker) == address(0)) {
            revert CcaNotSet();
        }
        if (protocolFeeRecipient == msg.sender) revert ProphetRecipient();

        string memory prophetLabel = _prophetOf[msg.sender];
        if (bytes(prophetLabel).length == 0) revert NotProphet();
        _requireSlug(slug);
        _requireProphecy(prophecy);
        bytes32 slugKey = keccak256(abi.encode(prophetLabel, slug));
        if (_slugTaken[slugKey]) revert SlugTaken();
        _slugTaken[slugKey] = true;

        string memory name_ = string.concat(slug, ".", prophetLabel, ".prophecy.eth");
        ProphecyToken minted = new ProphecyToken(name_, _symbolFromSlug(slug), address(this));
        token = address(minted);
        if (_auctionOf[token] != address(0)) revert AuctionExists();

        locker.prepare(token, msg.sender, protocolFeeRecipient);

        (bytes memory configData, bytes memory initializerParams, MigratorParameters memory mp) = CcaLib.build(
            token,
            address(lbpStrategy),
            protocolFeeRecipient,
            address(locker),
            address(hook),
            auctionBlocks,
            uint64(block.number)
        );
        bytes32 salt = keccak256(abi.encode(token, msg.sender, slug));
        if (!minted.approve(address(lbpStrategy), TOTAL_SUPPLY)) revert TokenTransferFailed();
        lbpStrategy.initializeDistribution(token, TOTAL_SUPPLY, configData, salt);

        address auction = IDistributorFactory(lbpStrategy.initializerFactory()).getAddress(
            token, AUCTION_SUPPLY, initializerParams, keccak256(abi.encode(salt, mp)), address(lbpStrategy)
        );
        if (auction == address(0) || auction.code.length == 0) revert AuctionNotCreated();
        _auctionOf[token] = auction;

        ens.registerProphecy(prophetLabel, slug, prophecy, deadline, token);
        emit Launched(token, msg.sender, auction, prophetLabel, slug);
    }

    function auctionOf(address token) external view returns (address) {
        return _auctionOf[token];
    }

    /// Forwards the auction's `isGraduated`. False if the token has no auction.
    /// After `endBlock`, callers should `checkpoint` first — the official view
    /// can be stale. Goal-not-reached: false; `exitBid` refunds; `claimTokens`
    /// reverts `NotGraduated`; migrate recovers LP reserve to protocol, no pool.
    function isGraduated(address token) external view returns (bool) {
        address auction = _auctionOf[token];
        if (auction == address(0)) return false;
        return ICca(auction).isGraduated();
    }

    function prophetOf(address wallet) external view returns (string memory) {
        return _prophetOf[wallet];
    }

    function _verifyWorldSig(uint256 nullifier, bytes calldata serverSig) internal view {
        if (serverSig.length != 65) revert InvalidSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly ("memory-safe") {
            r := calldataload(serverSig.offset)
            s := calldataload(add(serverSig.offset, 32))
            v := byte(0, calldataload(add(serverSig.offset, 64)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert InvalidSignature();
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            revert InvalidSignature();
        }

        bytes32 digest = keccak256(abi.encode(block.chainid, address(this), msg.sender, nullifier));
        address recovered =
            ecrecover(keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)), v, r, s);
        if (recovered == address(0) || recovered != worldSigner) revert InvalidSignature();
    }

    function _requireProphetLabel(string memory label) internal pure {
        bytes memory raw = bytes(label);
        uint256 n = raw.length;
        if (n < 3 || n > 16) revert BadLabel();
        for (uint256 i; i < n; ++i) {
            bytes1 ch = raw[i];
            bool ok = (ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9");
            if (!ok) revert BadLabel();
        }
    }

    function _requireProphecy(string memory prophecy) internal pure {
        uint256 n = bytes(prophecy).length;
        if (n < 1 || n > 140) revert BadProphecy();
    }

    function _requireSlug(string memory slug) internal pure {
        bytes memory raw = bytes(slug);
        uint256 n = raw.length;
        if (n < 3 || n > 32) revert BadSlug();
        if (raw[0] == "-" || raw[n - 1] == "-") revert BadSlug();
        for (uint256 i; i < n; ++i) {
            bytes1 ch = raw[i];
            bool ok = (ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9") || ch == "-";
            if (!ok) revert BadSlug();
        }
    }

    function _symbolFromSlug(string memory slug) internal pure returns (string memory) {
        bytes memory raw = bytes(slug);
        uint256 n = raw.length > 11 ? 11 : raw.length;
        bytes memory out = new bytes(n);
        for (uint256 i; i < n; ++i) {
            bytes1 ch = raw[i];
            if (ch >= "a" && ch <= "z") out[i] = bytes1(uint8(ch) - 32);
            else out[i] = ch;
        }
        return string(out);
    }
}
