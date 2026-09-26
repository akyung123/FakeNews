// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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
contract Launchpad is ReentrancyGuard {
    using SafeERC20 for IERC20;
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
    uint256 public protocolFees;
    address public immutable protocolFeeRecipient;

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
    error ExceedsSold();
    error EthTransferFailed();
    error NotImplemented();
    error ZeroAddress();

    constructor(address protocolFeeRecipient_) {
        if (protocolFeeRecipient_ == address(0)) revert ZeroAddress();
        protocolFeeRecipient = protocolFeeRecipient_;
    }

    /// World ID prophet names are a later milestone.
    function registerProphet(string calldata, uint256, bytes calldata) external pure {
        revert NotImplemented();
    }

    /// Opens a curve and mints the token. `prophecy` and `deadline` are not
    /// stored or emitted; they belong on the prophecy's ENS resolver.
    function launch(string calldata slug, string calldata, uint64, uint256 minTokensOut)
        external
        payable
        nonReentrant
        returns (address token)
    {
        _requireSlug(slug);
        string memory name_ = string.concat(slug, ".prophecy.eth");
        ProphecyToken minted = new ProphecyToken(name_, _symbolFromSlug(slug), address(this));
        token = address(minted);

        Curve storage c = _curves[token];
        c.vEth = VIRTUAL_ETH;
        c.vToken = VIRTUAL_TOKEN;
        c.prophet = msg.sender;

        emit Launched(token, msg.sender, "", slug);

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
        IERC20(token).safeTransferFrom(msg.sender, address(this), tokensIn);
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

    function prophetOf(address) external pure returns (string memory) {
        return "";
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
        IERC20(token).safeTransfer(buyer, preview.tokensOut);
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
}
