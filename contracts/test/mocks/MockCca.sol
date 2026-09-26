// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";

import {ProphecyToken} from "../../src/ProphecyToken.sol";
import {MigratorParameters} from "../../src/cca/CcaTypes.sol";

contract MockAuction {
    address public token;
    address public currency;
    address public tokensRecipient;
    address public fundsRecipient;
    uint64 public startBlock;
    uint64 public endBlock;
    uint64 public claimBlock;
    bool public graduated;

    function setGraduated(bool v) external {
        graduated = v;
    }

    function isGraduated() external view returns (bool) {
        return graduated;
    }

    function configure(address token_, address tokensRecipient_, address fundsRecipient_, uint64 start_, uint64 end_)
        external
    {
        token = token_;
        tokensRecipient = tokensRecipient_;
        fundsRecipient = fundsRecipient_;
        startBlock = start_;
        endBlock = end_;
        claimBlock = end_;
    }
}

contract MockCCAFactory {
    mapping(bytes32 => address) public deployed;

    function create(address token, uint256 amount, bytes calldata configData, bytes32 salt)
        external
        returns (address auction)
    {
        auction = address(new MockAuction());
        deployed[_key(token, amount, configData, salt, msg.sender)] = auction;
    }

    function getAddress(address token, uint256 amount, bytes calldata configData, bytes32 salt, address sender)
        external
        view
        returns (address)
    {
        return deployed[_key(token, amount, configData, salt, sender)];
    }

    function _key(address token, uint256 amount, bytes calldata configData, bytes32 salt, address sender)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(token, amount, keccak256(configData), salt, sender));
    }
}

/// Records `initializeDistribution` and deploys a mock auction via MockCCAFactory.
contract MockLBPStrategy {
    MockCCAFactory public factory;
    address public lastToken;
    uint256 public lastTotalSupply;
    bytes public lastConfigData;
    bytes32 public lastSalt;
    address public lastCaller;

    constructor() {
        factory = new MockCCAFactory();
    }

    function initializerFactory() external view returns (address) {
        return address(factory);
    }

    function initializeDistribution(address token, uint256 totalSupply, bytes calldata configData, bytes32 salt)
        external
    {
        lastToken = token;
        lastTotalSupply = totalSupply;
        lastConfigData = configData;
        lastSalt = salt;
        lastCaller = msg.sender;

        (MigratorParameters memory mp, bytes memory initializerParams) =
            abi.decode(configData, (MigratorParameters, bytes));
        uint256 auctionSupply = totalSupply - mp.reservedTokenAmountForLP;
        bytes32 initializerSalt = keccak256(abi.encode(salt, mp));
        address auction = factory.create(token, auctionSupply, initializerParams, initializerSalt);

        if (!ProphecyToken(token).transferFrom(msg.sender, auction, auctionSupply)) revert();
        if (!ProphecyToken(token).transferFrom(msg.sender, address(this), mp.reservedTokenAmountForLP)) revert();
    }
}

/// Minimal PositionManager: mints an NFT id and pays fees on `modifyLiquidities`.
contract MockPositionManager {
    uint256 public nextId = 1;
    mapping(uint256 => PoolKey) internal _keys;
    mapping(uint256 => address) public ownerOf;
    uint256 public ethFees;
    address public feeToken;
    uint256 public tokenFees;

    receive() external payable {}

    function setFees(uint256 ethFees_, address feeToken_, uint256 tokenFees_) external payable {
        ethFees = ethFees_;
        feeToken = feeToken_;
        tokenFees = tokenFees_;
    }

    function mintTo(address to, address token, address hook) external returns (uint256 id) {
        id = _store(to, _ethTokenKey(token, hook, 10_000, 200));
        (bool ok,) = to.call(
            abi.encodeWithSignature("onERC721Received(address,address,uint256,bytes)", msg.sender, address(this), id, "")
        );
        require(ok, "onERC721Received");
    }

    /// Official PositionManager `_mint` — no ERC-721 receiver callback.
    function mintSilent(address to, address token, address hook) external returns (uint256 id) {
        return _store(to, _ethTokenKey(token, hook, 10_000, 200));
    }

    function mintSilentWithKey(address to, PoolKey memory key) external returns (uint256 id) {
        return _store(to, key);
    }

    function _ethTokenKey(address token, address hook, uint24 fee, int24 tickSpacing)
        internal
        pure
        returns (PoolKey memory)
    {
        return PoolKey({
            currency0: CurrencyLibrary.ADDRESS_ZERO,
            currency1: Currency.wrap(token),
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: IHooks(hook)
        });
    }

    function _store(address to, PoolKey memory key) internal returns (uint256 id) {
        id = nextId++;
        _keys[id] = key;
        ownerOf[id] = to;
    }

    function getPoolAndPositionInfo(uint256 tokenId) external view returns (PoolKey memory, uint256) {
        return (_keys[tokenId], 0);
    }

    function getPositionLiquidity(uint256) external pure returns (uint128) {
        return 1e18;
    }

    function modifyLiquidities(bytes calldata, uint256) external payable {
        if (ethFees > 0) {
            (bool ok,) = msg.sender.call{value: ethFees}("");
            require(ok, "eth fee");
        }
        if (tokenFees > 0 && feeToken != address(0)) {
            require(ProphecyToken(feeToken).transfer(msg.sender, tokenFees), "tok fee");
        }
    }
}
