// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IProphecyEns} from "./ens/IProphecyEns.sol";
import {ProphecyToken} from "./ProphecyToken.sol";

/// Constant-product quotes and fee rounding. Multiply first, divide once.
library CurveMath {
    uint256 internal constant BPS = 10_000;
    uint256 public constant FEE_BPS = 125;
    uint256 public constant CREATOR_BPS = 30;
    uint256 public constant PROTOCOL_BPS = 95;

    function ceilMulDiv(uint256 a, uint256 b, uint256 denominator) internal pure returns (uint256) {
        return (a * b + (denominator - 1)) / denominator;
    }

    function feeOn(uint256 amount) internal pure returns (uint256) {
        return ceilMulDiv(amount, FEE_BPS, BPS);
    }

    function grossFromNet(uint256 ethNet) internal pure returns (uint256 ethIn) {
        if (ethNet == 0) return 0;
        ethIn = ceilMulDiv(ethNet, BPS, BPS - FEE_BPS);
        while (true) {
            uint256 fee = feeOn(ethIn);
            if (ethIn > fee && ethIn - fee >= ethNet) return ethIn;
            unchecked {
                ++ethIn;
            }
        }
    }

    function splitFee(uint256 fee) internal pure returns (uint256 creatorShare, uint256 protocolShare) {
        creatorShare = fee * CREATOR_BPS / FEE_BPS;
        protocolShare = fee - creatorShare;
    }

    function tokensOut(uint256 vEth, uint256 vToken, uint256 ethNet) internal pure returns (uint256) {
        return vToken * ethNet / (vEth + ethNet);
    }

    function ethOut(uint256 vEth, uint256 vToken, uint256 tokensIn) internal pure returns (uint256) {
        return vEth * tokensIn / (vToken + tokensIn);
    }
}

/// Bonding-curve launchpad. Price is the ratio of two reserves; fees sit in a
/// separate ledger so they never move that price.
contract Launchpad {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status = _NOT_ENTERED;

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000e18;
    uint256 public constant CURVE_SUPPLY = 793_100_000e18;
    uint256 public constant LP_SUPPLY = 206_900_000e18;
    uint256 public constant VIRTUAL_TOKEN = 1_073_000_000e18;
    uint256 public constant VIRTUAL_ETH = 7_058_378_514_689_194;
    uint256 public constant FEE_BPS = CurveMath.FEE_BPS;
    uint256 public constant CREATOR_BPS = CurveMath.CREATOR_BPS;
    uint256 public constant PROTOCOL_BPS = CurveMath.PROTOCOL_BPS;

    uint256 internal constant MAX_MEMO = 140;

    struct Curve {
        uint256 vEth;
        uint256 vToken;
        uint256 realEth;
        uint256 sold;
        bool complete;
        address prophet;
    }

    struct BuyPreview {
        uint256 tokensOut;
        uint256 fee;
        uint256 ethNet;
        uint256 ethUsed;
        uint256 refund;
        bool completes;
    }

    mapping(address token => Curve) internal _curves;
    mapping(address wallet => uint256) internal _creatorFees;
    mapping(uint256 nullifier => bool) internal _nullifierUsed;
    mapping(bytes32 labelHash => bool) internal _labelTaken;
    mapping(address wallet => string) internal _prophetOf;
    mapping(bytes32 slugKey => bool) internal _slugTaken;
    uint256 public protocolFees;
    address public immutable protocolFeeRecipient;
    address public immutable worldSigner;
    IProphecyEns public immutable ens;

    event ProphetRegistered(address indexed wallet, string label, uint256 nullifier);
    event Launched(address indexed token, address indexed prophet, string prophetLabel, string slug);
    event Trade(
        address indexed token,
        address indexed trader,
        bool isBuy,
        uint256 ethAmount,
        uint256 tokenAmount,
        uint256 fee,
        uint256 vEthAfter,
        uint256 vTokenAfter,
        string memo
    );
    event CreatorFeeClaimed(address indexed prophet, uint256 amount);
    event ProtocolFeeClaimed(address indexed recipient, uint256 amount);

    error UnknownToken();
    error CurveComplete();
    error ZeroAmount();
    error Slippage();
    error MemoTooLong();
    error BadSlug();
    error BadLabel();
    error BadProphecy();
    error InvalidSignature();
    error NullifierUsed();
    error LabelTaken();
    error AlreadyProphet();
    error NotProphet();
    error SlugTaken();
    error ExceedsSold();
    error EthTransferFailed();
    error ZeroAddress();
    error Reentrant();
    error TokenTransferFailed();

    modifier nonReentrant() {
        if (_status == _ENTERED) revert Reentrant();
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    constructor(address protocolFeeRecipient_, address worldSigner_, IProphecyEns ens_) {
        if (
            protocolFeeRecipient_ == address(0) || worldSigner_ == address(0) || address(ens_) == address(0)
        ) revert ZeroAddress();
        protocolFeeRecipient = protocolFeeRecipient_;
        worldSigner = worldSigner_;
        ens = ens_;
    }

    /// World ID server signs `keccak256(abi.encode(chainId, launchpad, wallet, nullifier))`
    /// with EIP-191 (`world/src/encode.ts`). Reconstructing that digest with
    /// `block.chainid` and `address(this)` rejects a sig pinned to another chain
    /// or launchpad (PR #16 context_mismatch). One nullifier, one prophet name.
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

    /// Opens a curve and mints the token. `prophecy` and `deadline` are written
    /// only into the prophecy resolver at initialize — never stored or emitted.
    function launch(string calldata slug, string calldata prophecy, uint64 deadline, uint256 minTokensOut)
        external
        payable
        nonReentrant
        returns (address token)
    {
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

        Curve storage c = _curves[token];
        c.vEth = VIRTUAL_ETH;
        c.vToken = VIRTUAL_TOKEN;
        c.prophet = msg.sender;

        ens.registerProphecy(prophetLabel, slug, prophecy, deadline, token);
        emit Launched(token, msg.sender, prophetLabel, slug);

        if (msg.value > 0) {
            BuyPreview memory preview = _previewBuy(c, msg.value);
            if (preview.tokensOut < minTokensOut) revert Slippage();
            _applyBuy(token, c, preview, msg.sender, "");
        } else if (minTokensOut != 0) {
            revert Slippage();
        }
    }

    function buy(address token, uint256 minTokensOut, string calldata memo) external payable nonReentrant {
        _requireMemo(memo);
        Curve storage c = _curves[token];
        BuyPreview memory preview = _previewBuy(c, msg.value);
        if (preview.tokensOut < minTokensOut) revert Slippage();
        _applyBuy(token, c, preview, msg.sender, memo);
    }

    function sell(address token, uint256 tokensIn, uint256 minEthOut, string calldata memo) external nonReentrant {
        _requireMemo(memo);
        Curve storage c = _curves[token];
        (uint256 rawOut, uint256 fee, uint256 payout) = _previewSell(c, tokensIn);
        if (payout < minEthOut) revert Slippage();

        uint256 creatorShare;
        uint256 protocolShare;
        (creatorShare, protocolShare) = CurveMath.splitFee(fee);

        c.vEth -= rawOut;
        c.vToken += tokensIn;
        c.realEth -= rawOut;
        c.sold -= tokensIn;

        _creatorFees[c.prophet] += creatorShare;
        protocolFees += protocolShare;

        _emitTrade(token, msg.sender, false, payout, tokensIn, fee, c.vEth, c.vToken, memo);
        _transferTokenFrom(token, msg.sender, address(this), tokensIn);
        _sendEth(msg.sender, payout);
    }

    function claimCreatorFee() external nonReentrant {
        uint256 amount = _creatorFees[msg.sender];
        if (amount == 0) revert ZeroAmount();
        _creatorFees[msg.sender] = 0;
        emit CreatorFeeClaimed(msg.sender, amount);
        _sendEth(msg.sender, amount);
    }

    /// Anyone may call. ETH goes only to the constructor recipient.
    function claimProtocolFee() external nonReentrant {
        uint256 amount = protocolFees;
        if (amount == 0) revert ZeroAmount();
        protocolFees = 0;
        emit ProtocolFeeClaimed(protocolFeeRecipient, amount);
        _sendEth(protocolFeeRecipient, amount);
    }

    function curve(address token)
        external
        view
        returns (uint256 vEth, uint256 vToken, uint256 realEth, uint256 sold, bool complete)
    {
        Curve storage c = _curves[token];
        if (c.prophet == address(0)) revert UnknownToken();
        return (c.vEth, c.vToken, c.realEth, c.sold, c.complete);
    }

    function quoteBuy(address token, uint256 ethIn) external view returns (uint256 tokensOut, uint256 fee) {
        BuyPreview memory preview = _previewBuy(_curves[token], ethIn);
        return (preview.tokensOut, preview.fee);
    }

    function quoteSell(address token, uint256 tokensIn) external view returns (uint256 ethOut, uint256 fee) {
        (uint256 rawOut, uint256 fee_, uint256 payout) = _previewSell(_curves[token], tokensIn);
        rawOut;
        return (payout, fee_);
    }

    function prophetOf(address wallet) external view returns (string memory) {
        return _prophetOf[wallet];
    }

    function creatorFeeOf(address wallet) external view returns (uint256) {
        return _creatorFees[wallet];
    }

    function _previewBuy(Curve storage c, uint256 ethIn) internal view returns (BuyPreview memory preview) {
        if (c.prophet == address(0)) revert UnknownToken();
        if (c.complete) revert CurveComplete();
        if (ethIn == 0) revert ZeroAmount();

        uint256 remaining = CURVE_SUPPLY - c.sold;
        if (remaining == 0) revert CurveComplete();

        preview.fee = CurveMath.feeOn(ethIn);
        if (preview.fee >= ethIn) revert ZeroAmount();
        preview.ethNet = ethIn - preview.fee;
        preview.tokensOut = CurveMath.tokensOut(c.vEth, c.vToken, preview.ethNet);
        preview.ethUsed = ethIn;

        if (preview.tokensOut >= remaining) {
            preview.completes = true;
            preview.tokensOut = remaining;
            uint256 needNet = CurveMath.ceilMulDiv(remaining, c.vEth, c.vToken - remaining);
            preview.ethUsed = CurveMath.grossFromNet(needNet);
            if (preview.ethUsed > ethIn) revert Slippage();
            preview.fee = CurveMath.feeOn(preview.ethUsed);
            preview.ethNet = preview.ethUsed - preview.fee;
            preview.refund = ethIn - preview.ethUsed;
        }
    }

    function _previewSell(Curve storage c, uint256 tokensIn)
        internal
        view
        returns (uint256 rawOut, uint256 fee, uint256 payout)
    {
        if (c.prophet == address(0)) revert UnknownToken();
        if (c.complete) revert CurveComplete();
        if (tokensIn == 0) revert ZeroAmount();
        if (tokensIn > c.sold) revert ExceedsSold();

        rawOut = CurveMath.ethOut(c.vEth, c.vToken, tokensIn);
        if (rawOut == 0 || rawOut > c.realEth) revert ZeroAmount();
        fee = CurveMath.feeOn(rawOut);
        if (fee > rawOut) revert ZeroAmount();
        payout = rawOut - fee;
    }

    function _applyBuy(address token, Curve storage c, BuyPreview memory preview, address buyer, string memory memo)
        internal
    {
        if (preview.tokensOut == 0) revert ZeroAmount();

        (uint256 creatorShare, uint256 protocolShare) = CurveMath.splitFee(preview.fee);

        c.vEth += preview.ethNet;
        c.vToken -= preview.tokensOut;
        c.realEth += preview.ethNet;
        c.sold += preview.tokensOut;
        if (preview.completes) c.complete = true;

        _creatorFees[c.prophet] += creatorShare;
        protocolFees += protocolShare;

        _emitTrade(token, buyer, true, preview.ethUsed, preview.tokensOut, preview.fee, c.vEth, c.vToken, memo);
        _transferToken(token, buyer, preview.tokensOut);
        if (preview.refund > 0) _sendEth(buyer, preview.refund);
    }

    function _emitTrade(
        address token,
        address trader,
        bool isBuy,
        uint256 ethAmount,
        uint256 tokenAmount,
        uint256 fee,
        uint256 vEthAfter,
        uint256 vTokenAfter,
        string memory memo
    ) internal {
        emit Trade(token, trader, isBuy, ethAmount, tokenAmount, fee, vEthAfter, vTokenAfter, memo);
    }

    function _requireMemo(string calldata memo) internal pure {
        if (bytes(memo).length > MAX_MEMO) revert MemoTooLong();
    }

    /// EIP-191 personal_sign of the 32-byte world/ digest. chainId and launchpad
    /// are not calldata: they are taken from this chain and this contract.
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

    function _sendEth(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert EthTransferFailed();
    }

    function _transferToken(address token, address to, uint256 value) internal {
        if (!ProphecyToken(token).transfer(to, value)) revert TokenTransferFailed();
    }

    function _transferTokenFrom(address token, address from, address to, uint256 value) internal {
        if (!ProphecyToken(token).transferFrom(from, to, value)) revert TokenTransferFailed();
    }
}
