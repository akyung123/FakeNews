// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {Launchpad} from "../src/Launchpad.sol";
import {ProphecyToken} from "../src/ProphecyToken.sol";

/// Fixed quotes the web curve helper should match (`web/src/lib/curve.ts`).
contract LaunchpadVectorsTest is Test {
    Launchpad internal launchpad;
    address internal token;

    function setUp() public {
        launchpad = new Launchpad();
        vm.deal(address(this), 10 ether);
        token = launchpad.launch("lingo-2028", "", 0, 0);
    }

    function test_vector_buy001AtStart() public view {
        (uint256 tokensOut, uint256 fee) = launchpad.quoteBuy(token, 0.001 ether);
        assertEq(fee, 12_500_000_000_000);
        assertEq(tokensOut, 131_693_201_440_406_167_649_784_217);
    }

    function test_vector_sellBack001() public {
        launchpad.buy{value: 0.001 ether}(token, 0, "");
        uint256 tokensIn = 131_693_201_440_406_167_649_784_217;
        (uint256 payout, uint256 fee) = launchpad.quoteSell(token, tokensIn);
        assertEq(fee, 12_343_750_000_000);
        assertEq(payout, 975_156_249_999_999);
    }

    function test_vector_buy01AtStart() public view {
        (uint256 tokensOut, uint256 fee) = launchpad.quoteBuy(token, 0.01 ether);
        assertEq(fee, 125_000_000_000_000);
        assertEq(tokensOut, 625_738_980_015_618_190_379_932_827);
    }

    function test_vector_buy001MatchesOnchain() public {
        (uint256 quoted, uint256 fee) = launchpad.quoteBuy(token, 0.001 ether);
        launchpad.buy{value: 0.001 ether}(token, quoted, "");
        assertEq(ProphecyToken(token).balanceOf(address(this)), quoted);
        (uint256 vEth, uint256 vToken, uint256 realEth, uint256 sold,) = launchpad.curve(token);
        assertEq(sold, quoted);
        assertEq(realEth, 0.001 ether - fee);
        assertEq(vEth, launchpad.VIRTUAL_ETH() + realEth);
        assertEq(vToken, launchpad.VIRTUAL_TOKEN() - quoted);
    }

    function test_vector_completeFill() public {
        (uint256 tokensOut, uint256 fee) = launchpad.quoteBuy(token, 1 ether);
        assertEq(tokensOut, 793_100_000e18);
        assertEq(fee, 253_164_556_962_026);

        uint256 before = address(this).balance;
        launchpad.buy{value: 1 ether}(token, tokensOut, "");
        uint256 spent = before - address(this).balance;
        assertEq(spent, 20_253_164_556_962_026);
        (,, uint256 realEth, uint256 sold, bool complete) = launchpad.curve(token);
        assertTrue(complete);
        assertEq(sold, 793_100_000e18);
        assertEq(realEth, 0.02 ether);
    }

    receive() external payable {}
}
