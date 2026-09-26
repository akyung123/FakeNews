// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";

import {CurveMath} from "../src/CurveMath.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {ProphecyToken} from "../src/ProphecyToken.sol";

contract LaunchpadTest is Test {
    Launchpad internal launchpad;
    address internal prophet = address(0xA11CE);
    address internal buyer = address(0xB0B);

    function setUp() public {
        launchpad = new Launchpad();
        vm.deal(prophet, 100 ether);
        vm.deal(buyer, 100 ether);
    }

    function _launch() internal returns (address token) {
        vm.prank(prophet);
        token = launchpad.launch("lingo-2028", "", 0, 0);
    }

    function test_constantsMatchSpec() public view {
        assertEq(launchpad.TOTAL_SUPPLY(), 1_000_000_000e18);
        assertEq(launchpad.CURVE_SUPPLY(), 793_100_000e18);
        assertEq(launchpad.LP_SUPPLY(), 206_900_000e18);
        assertEq(launchpad.VIRTUAL_TOKEN(), 1_073_000_000e18);
        assertEq(launchpad.VIRTUAL_ETH(), 7_058_378_514_689_194);
        assertEq(launchpad.FEE_BPS(), 125);
        assertEq(launchpad.CREATOR_BPS(), 30);
        assertEq(launchpad.PROTOCOL_BPS(), 95);
    }

    function test_formulaSmallIntegers() public pure {
        // SPEC check: reserve 10 / 100, deposit 10 → half the inventory.
        assertEq(CurveMath.tokensOut(10, 100, 10), 50);
        assertEq(CurveMath.ethOut(20, 50, 50), 10);
    }

    function test_launchMintsToLaunchpadAndOpensReserves() public {
        address token = _launch();
        (uint256 vEth, uint256 vToken, uint256 realEth, uint256 sold, bool complete) = launchpad.curve(token);
        assertEq(vEth, launchpad.VIRTUAL_ETH());
        assertEq(vToken, launchpad.VIRTUAL_TOKEN());
        assertEq(realEth, 0);
        assertEq(sold, 0);
        assertFalse(complete);
        assertEq(ProphecyToken(token).balanceOf(address(launchpad)), 1_000_000_000e18);
        assertEq(ProphecyToken(token).name(), "lingo-2028.prophecy.eth");
        assertEq(ProphecyToken(token).symbol(), "LINGO-2028");
        assertEq(bytes(launchpad.prophetOf(prophet)), bytes(""));
    }

    function test_launchDoesNotStoreSentenceOrDeadline() public {
        string memory sentence = "a sentence that must not be stored";
        vm.recordLogs();
        vm.prank(prophet);
        address token = launchpad.launch("lingo-2028", sentence, 1_800_000_000, 0);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes memory needle = bytes(sentence);
        for (uint256 i; i < logs.length; ++i) {
            assertFalse(_containsBytes(logs[i].data, needle), "sentence leaked into an event");
            assertFalse(_containsWord(logs[i].data, bytes32(uint256(1_800_000_000))), "deadline leaked into an event");
        }
        // Reserves exist; sentence/deadline are not in the curve struct.
        (uint256 vEth,,,,) = launchpad.curve(token);
        assertEq(vEth, launchpad.VIRTUAL_ETH());
    }

    function test_buyThenSellUpdatesReservesAndFees() public {
        address token = _launch();
        uint256 ethIn = 0.001 ether;
        (uint256 tokensOut, uint256 buyFee) = launchpad.quoteBuy(token, ethIn);

        vm.prank(buyer);
        launchpad.buy{value: ethIn}(token, tokensOut, "here we go");

        (uint256 vEth, uint256 vToken, uint256 realEth, uint256 sold, bool complete) = launchpad.curve(token);
        assertEq(sold, tokensOut);
        assertEq(realEth, ethIn - buyFee);
        assertEq(vEth, launchpad.VIRTUAL_ETH() + realEth);
        assertEq(vToken, launchpad.VIRTUAL_TOKEN() - tokensOut);
        assertFalse(complete);
        assertEq(ProphecyToken(token).balanceOf(buyer), tokensOut);
        assertEq(address(launchpad).balance, ethIn);

        (uint256 creatorShare, uint256 protocolShare) = CurveMath.splitFee(buyFee);
        assertEq(launchpad.creatorFeeOf(prophet), creatorShare);
        assertEq(launchpad.protocolFees(), protocolShare);
        assertEq(creatorShare + protocolShare, buyFee);

        vm.startPrank(buyer);
        ProphecyToken(token).approve(address(launchpad), tokensOut);
        (uint256 payout, uint256 sellFee) = launchpad.quoteSell(token, tokensOut);
        uint256 before = buyer.balance;
        launchpad.sell(token, tokensOut, payout, "sold");
        vm.stopPrank();

        assertEq(buyer.balance, before + payout);
        assertEq(ProphecyToken(token).balanceOf(buyer), 0);
        (vEth, vToken, realEth, sold, complete) = launchpad.curve(token);
        assertEq(sold, 0);
        // Flooring the inverse can leave 1 wei of real ETH in the reserve.
        assertLe(realEth, 1);
        assertEq(vEth, launchpad.VIRTUAL_ETH() + realEth);
        assertEq(vToken, launchpad.VIRTUAL_TOKEN());
        assertFalse(complete);
        assertEq(launchpad.protocolFees() + launchpad.creatorFeeOf(prophet), buyFee + sellFee);
        _assertSolvent(token);
    }

    function test_buyRevertsOnSlippageAndBadMemo() public {
        address token = _launch();
        vm.prank(buyer);
        vm.expectRevert(Launchpad.Slippage.selector);
        launchpad.buy{value: 0.001 ether}(token, type(uint256).max, "");

        bytes memory longMemo = new bytes(141);
        vm.prank(buyer);
        vm.expectRevert(Launchpad.MemoTooLong.selector);
        launchpad.buy{value: 0.001 ether}(token, 0, string(longMemo));
    }

    function test_sellRevertsAfterComplete() public {
        address token = _launch();
        vm.prank(buyer);
        launchpad.buy{value: 1 ether}(token, 0, "");
        (,,,, bool complete) = launchpad.curve(token);
        assertTrue(complete);

        vm.prank(buyer);
        vm.expectRevert(Launchpad.CurveComplete.selector);
        launchpad.buy{value: 0.001 ether}(token, 0, "");

        uint256 bal = ProphecyToken(token).balanceOf(buyer);
        vm.startPrank(buyer);
        ProphecyToken(token).approve(address(launchpad), bal);
        vm.expectRevert(Launchpad.CurveComplete.selector);
        launchpad.sell(token, bal, 0, "");
        vm.stopPrank();
    }

    function test_lastBuyFillsOnlyRemainingAndRefunds() public {
        address token = _launch();
        uint256 before = buyer.balance;
        vm.prank(buyer);
        launchpad.buy{value: 1 ether}(token, 0, "");

        (uint256 vEth, uint256 vToken, uint256 realEth, uint256 sold, bool complete) = launchpad.curve(token);
        assertTrue(complete);
        assertEq(sold, launchpad.CURVE_SUPPLY());
        assertEq(vToken, launchpad.VIRTUAL_TOKEN() - launchpad.CURVE_SUPPLY());
        assertEq(realEth, 0.02 ether);
        assertEq(vEth, launchpad.VIRTUAL_ETH() + 0.02 ether);
        assertEq(ProphecyToken(token).balanceOf(buyer), launchpad.CURVE_SUPPLY());
        assertLt(before - buyer.balance, 1 ether);
        assertEq(address(launchpad).balance, before - buyer.balance);
        _assertSolvent(token);
    }

    function test_claimCreatorFeePaysOnlyTheProphet() public {
        address token = _launch();
        vm.prank(buyer);
        launchpad.buy{value: 0.001 ether}(token, 0, "");
        uint256 owed = launchpad.creatorFeeOf(prophet);
        assertGt(owed, 0);

        uint256 before = prophet.balance;
        vm.prank(prophet);
        launchpad.claimCreatorFee();
        assertEq(prophet.balance, before + owed);
        assertEq(launchpad.creatorFeeOf(prophet), 0);

        vm.prank(buyer);
        vm.expectRevert(Launchpad.ZeroAmount.selector);
        launchpad.claimCreatorFee();
    }

    function test_neverPricesFromContractBalance() public {
        address token = _launch();
        vm.deal(address(launchpad), 5 ether);
        (uint256 tokensA, uint256 feeA) = launchpad.quoteBuy(token, 0.001 ether);

        address clean = address(new Launchpad());
        vm.prank(prophet);
        address tokenB = Launchpad(clean).launch("eth-10k", "", 0, 0);
        (uint256 tokensB, uint256 feeB) = Launchpad(clean).quoteBuy(tokenB, 0.001 ether);
        assertEq(tokensA, tokensB);
        assertEq(feeA, feeB);
    }

    function test_launchWithValueBuys() public {
        vm.prank(prophet);
        address token = launchpad.launch{value: 0.001 ether}("lingo-2028", "", 0, 0);
        (, , uint256 realEth, uint256 sold,) = launchpad.curve(token);
        assertGt(sold, 0);
        assertGt(realEth, 0);
        assertEq(ProphecyToken(token).balanceOf(prophet), sold);
    }

    function test_registerProphetNotYet() public {
        vm.expectRevert(Launchpad.NotImplemented.selector);
        launchpad.registerProphet("ringo", 1, "");
    }

    function test_badSlugReverts() public {
        vm.prank(prophet);
        vm.expectRevert(Launchpad.BadSlug.selector);
        launchpad.launch("ab", "", 0, 0);
    }

    function _assertSolvent(address token) internal view {
        (,, uint256 realEth,,) = launchpad.curve(token);
        assertGe(address(launchpad).balance, realEth + launchpad.protocolFees() + launchpad.creatorFeeOf(prophet));
    }

    function _containsWord(bytes memory data, bytes32 word) internal pure returns (bool) {
        if (data.length < 32) return false;
        for (uint256 i; i + 32 <= data.length; ++i) {
            bytes32 slice;
            assembly {
                slice := mload(add(add(data, 32), i))
            }
            if (slice == word) return true;
        }
        return false;
    }

    function _containsBytes(bytes memory data, bytes memory needle) internal pure returns (bool) {
        if (needle.length == 0 || data.length < needle.length) return false;
        for (uint256 i; i + needle.length <= data.length; ++i) {
            bool match_ = true;
            for (uint256 j; j < needle.length; ++j) {
                if (data[i + j] != needle[j]) {
                    match_ = false;
                    break;
                }
            }
            if (match_) return true;
        }
        return false;
    }
}
