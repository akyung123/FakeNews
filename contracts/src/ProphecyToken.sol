// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// ERC-20 for one prophecy. The whole supply is minted to the Launchpad.
/// Name is the prophecy name; symbol is the slug in upper case (at most 11 chars).
contract ProphecyToken is ERC20 {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000e18;

    constructor(string memory name_, string memory symbol_, address mintTo) ERC20(name_, symbol_) {
        _mint(mintTo, TOTAL_SUPPLY);
    }
}
