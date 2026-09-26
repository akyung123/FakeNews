// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ProphecyToken} from "../src/ProphecyToken.sol";

contract ProphecyTokenTest is Test {
    function test_mintsFullSupplyToLaunchpad() public {
        address launchpad = address(0xB0B);
        ProphecyToken token = new ProphecyToken("lingo-2028.prophecy.eth", "LINGO-2028", launchpad);
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 1_000_000_000e18);
        assertEq(token.balanceOf(launchpad), 1_000_000_000e18);
        assertEq(token.name(), "lingo-2028.prophecy.eth");
        assertEq(token.symbol(), "LINGO-2028");
    }
}
