// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ForkE2EBase} from "./ForkE2EHelpers.sol";

/// Curve buy/sell fork coverage lived on `main`. Path B2 on `cca` replaces the
/// curve; a separate agent owns the official LBP Sepolia-fork config test.
contract ForkE2ETest is ForkE2EBase {
    function test_curveForkSuiteRetiredOnCcaBranch() public pure {
        assertTrue(true);
    }
}
