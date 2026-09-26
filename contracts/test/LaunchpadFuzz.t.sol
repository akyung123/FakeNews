// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {Launchpad} from "../src/Launchpad.sol";
import {ProphecyToken} from "../src/ProphecyToken.sol";

contract LaunchpadFuzzTest is Test {
    Launchpad internal launchpad;
    address internal prophet = address(0xA11CE);

    address[] internal traders;

    function setUp() public {
        launchpad = new Launchpad();
        vm.deal(prophet, 100 ether);
        traders.push(address(0x101));
        traders.push(address(0x102));
        traders.push(address(0x103));
        for (uint256 i; i < traders.length; ++i) {
            vm.deal(traders[i], 100 ether);
        }
    }

    function _launch() internal returns (address token) {
        vm.prank(prophet);
        token = launchpad.launch("lingo-2028", "", 0, 0);
    }

    function _assertSolvent(address token) internal view {
        (uint256 vEth,, uint256 realEth, uint256 sold,) = launchpad.curve(token);
        uint256 reserved = realEth + launchpad.protocolFees() + launchpad.creatorFeeOf(prophet);
        assertGe(address(launchpad).balance, reserved, "balance covers reserves and fees");
        assertEq(vEth, launchpad.VIRTUAL_ETH() + realEth, "realEth tracks vEth");
        assertEq(sold, launchpad.VIRTUAL_TOKEN() - _vToken(token), "sold tracks vToken");
        assertLe(sold, launchpad.CURVE_SUPPLY());
        assertLe(realEth, vEth);
    }

    function _vToken(address token) internal view returns (uint256 vToken) {
        (, vToken,,,) = launchpad.curve(token);
    }

    /// Contract ETH never drops below real curve ETH plus the fee ledger.
    function testFuzz_solvency(uint256 seed) public {
        address token = _launch();
        uint256 actions = bound(seed, 1, 12);
        uint256 cursor = uint256(keccak256(abi.encode(seed, "walk")));

        for (uint256 i; i < actions; ++i) {
            cursor = uint256(keccak256(abi.encode(cursor, i)));
            address trader = traders[cursor % traders.length];
            (,,,, bool complete) = launchpad.curve(token);
            if (complete) break;

            bool tryBuy = (cursor >> 8) % 2 == 0 || ProphecyToken(token).balanceOf(trader) == 0;
            if (tryBuy) {
                uint256 ethIn = bound(cursor >> 16, 2, 0.03 ether);
                vm.prank(trader);
                try launchpad.buy{value: ethIn}(token, 0, "") {} catch {}
            } else {
                uint256 bal = ProphecyToken(token).balanceOf(trader);
                uint256 tokensIn = bound(cursor >> 32, 1, bal);
                vm.startPrank(trader);
                ProphecyToken(token).approve(address(launchpad), tokensIn);
                try launchpad.sell(token, tokensIn, 0, "") {} catch {}
                vm.stopPrank();
            }
            _assertSolvent(token);
        }
        _assertSolvent(token);
    }

    /// A buy followed by selling every token received never returns more ETH than was spent.
    function testFuzz_roundTripNeverGains(uint256 ethIn) public {
        address token = _launch();
        // Below ~3 wei a sell-back floors to 0 ETH and reverts ZeroAmount.
        ethIn = bound(ethIn, 1_000, 0.015 ether);

        vm.prank(traders[0]);
        launchpad.buy{value: ethIn}(token, 0, "");

        uint256 tokens = ProphecyToken(token).balanceOf(traders[0]);
        assertGt(tokens, 0);

        uint256 before = traders[0].balance;
        vm.startPrank(traders[0]);
        ProphecyToken(token).approve(address(launchpad), tokens);
        launchpad.sell(token, tokens, 0, "");
        vm.stopPrank();

        uint256 received = traders[0].balance - before;
        assertLe(received, ethIn, "round trip must not gain ETH");
        (,, uint256 realEth, uint256 sold,) = launchpad.curve(token);
        assertEq(sold, 0);
        // Flooring the inverse can leave 1 wei of real ETH in the reserve.
        assertLe(realEth, 1);
        _assertSolvent(token);
    }
}
