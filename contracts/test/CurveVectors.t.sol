// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {stdJson} from "forge-std/StdJson.sol";

import {ProphecyToken} from "../src/ProphecyToken.sol";
import {LaunchpadTestBase} from "./LaunchpadHelpers.sol";

/// Reads `test/Curve.vectors.json` so web/src/lib/curve.ts can reuse
/// the same SPEC-derived integers.
contract CurveVectorsTest is LaunchpadTestBase {
    using stdJson for string;

    address internal token;
    string internal vectors;

    function setUp() public {
        _deployLaunchpad();
        prophet = address(this);
        vm.deal(address(this), 10 ether);
        token = _registerAndLaunch();
        vectors = vm.readFile(string.concat(vm.projectRoot(), "/test/Curve.vectors.json"));
    }

    function test_fixtureConstantsMatchLaunchpad() public view {
        assertEq(launchpad.TOTAL_SUPPLY(), vectors.readUint(".constants.TOTAL_SUPPLY"));
        assertEq(launchpad.CURVE_SUPPLY(), vectors.readUint(".constants.CURVE_SUPPLY"));
        assertEq(launchpad.LP_SUPPLY(), vectors.readUint(".constants.LP_SUPPLY"));
        assertEq(launchpad.VIRTUAL_TOKEN(), vectors.readUint(".constants.VIRTUAL_TOKEN"));
        assertEq(launchpad.VIRTUAL_ETH(), vectors.readUint(".constants.VIRTUAL_ETH"));
        assertEq(launchpad.FEE_BPS(), vectors.readUint(".constants.FEE_BPS"));
        assertEq(launchpad.CREATOR_BPS(), vectors.readUint(".constants.CREATOR_BPS"));
        assertEq(launchpad.PROTOCOL_BPS(), vectors.readUint(".constants.PROTOCOL_BPS"));
    }

    function test_vector_buy001AtStart() public view {
        (uint256 tokensOut, uint256 fee) = launchpad.quoteBuy(token, vectors.readUint(".vectors[0].ethIn"));
        assertEq(fee, vectors.readUint(".vectors[0].fee"));
        assertEq(tokensOut, vectors.readUint(".vectors[0].tokensOut"));
    }

    function test_vector_sellBack001() public {
        launchpad.buy{value: vectors.readUint(".vectors[0].ethIn")}(token, 0, "");
        uint256 tokensIn = vectors.readUint(".vectors[1].tokensIn");
        (uint256 payout, uint256 fee) = launchpad.quoteSell(token, tokensIn);
        assertEq(fee, vectors.readUint(".vectors[1].fee"));
        assertEq(payout, vectors.readUint(".vectors[1].ethOut"));
    }

    function test_vector_buy01AtStart() public view {
        (uint256 tokensOut, uint256 fee) = launchpad.quoteBuy(token, vectors.readUint(".vectors[2].ethIn"));
        assertEq(fee, vectors.readUint(".vectors[2].fee"));
        assertEq(tokensOut, vectors.readUint(".vectors[2].tokensOut"));
    }

    function test_vector_buy001MatchesOnchain() public {
        uint256 ethIn = vectors.readUint(".vectors[0].ethIn");
        (uint256 quoted, uint256 fee) = launchpad.quoteBuy(token, ethIn);
        assertEq(quoted, vectors.readUint(".vectors[0].tokensOut"));
        launchpad.buy{value: ethIn}(token, quoted, "");
        assertEq(ProphecyToken(token).balanceOf(address(this)), quoted);
        (uint256 vEth, uint256 vToken, uint256 realEth, uint256 sold,) = launchpad.curve(token);
        assertEq(sold, quoted);
        assertEq(realEth, ethIn - fee);
        assertEq(vEth, launchpad.VIRTUAL_ETH() + realEth);
        assertEq(vToken, launchpad.VIRTUAL_TOKEN() - quoted);
    }

    function test_vector_completeFill() public {
        uint256 ethIn = vectors.readUint(".vectors[3].ethIn");
        (uint256 tokensOut, uint256 fee) = launchpad.quoteBuy(token, ethIn);
        assertEq(tokensOut, vectors.readUint(".vectors[3].tokensOut"));
        assertEq(fee, vectors.readUint(".vectors[3].fee"));
        assertTrue(vectors.readBool(".vectors[3].completes"));

        uint256 before = address(this).balance;
        launchpad.buy{value: ethIn}(token, tokensOut, "");
        uint256 spent = before - address(this).balance;
        assertEq(spent, vectors.readUint(".vectors[3].ethUsed"));
        (,, uint256 realEth, uint256 sold, bool complete) = launchpad.curve(token);
        assertTrue(complete);
        assertEq(sold, vectors.readUint(".vectors[3].tokensOut"));
        assertEq(realEth, vectors.readUint(".vectors[3].realEthAfter"));
    }

    receive() external payable {}
}
