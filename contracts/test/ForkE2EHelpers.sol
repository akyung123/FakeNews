// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LaunchpadTestBase} from "./LaunchpadHelpers.sol";

address constant SEPOLIA_POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
address constant SEPOLIA_LBP_STRATEGY = 0x95434E898Af471945Cab33D5064d2aC1A6Ba2000;
address constant SEPOLIA_CCA_FACTORY = 0x000000001F26a0044BaA66024e7b6599c61963F8;

/// Shared fork constants. Curve buy/sell helpers are gone on this branch.
abstract contract ForkE2EBase is LaunchpadTestBase {}
