// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// ERC-20 + bonding curve for one prophecy. Skeleton — curve math is written at the event.
/// See README.md for the planned constant-product curve with virtual reserves.
contract ProphecyCoin {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000e18;
    uint256 public constant CURVE_SUPPLY = 800_000_000e18;

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    string public prophecy;
    address public immutable creator;

    bool public graduated;

    event Trade(address indexed trader, bool isBuy, uint256 ethAmount, uint256 tokenAmount);
    event Graduated();

    constructor(string memory name_, string memory symbol_, string memory prophecy_, address creator_) {
        name = name_;
        symbol = symbol_;
        prophecy = prophecy_;
        creator = creator_;
    }

    // TODO(event): ERC-20 balances / transfer / approve.

    function buy(uint256 /* minTokensOut */ ) external payable {
        revert("TODO: curve buy");
    }

    function sell(uint256, /* tokensIn */ uint256 /* minEthOut */ ) external pure {
        revert("TODO: curve sell");
    }
}
