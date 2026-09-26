// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Constant-product quotes and fee rounding for the bonding curve.
/// Multiply first, divide once. Remainders are dropped except where a fee or
/// a buy cost rounds up so the protocol keeps the spare wei.
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

    /// Smallest gross ETH such that `gross - feeOn(gross) >= ethNet`.
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
