// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ProphecyFactory} from "../src/ProphecyFactory.sol";
import {ProphecyCoin} from "../src/ProphecyCoin.sol";

/// Skeleton check without forge-std: a launch records the prophecy.
contract ProphecyFactoryTest {
    function test_createCoinStoresProphecy() public {
        ProphecyFactory factory = new ProphecyFactory();
        address coin = factory.createCoin("Wifi Dies", "WIFI", "The Wi-Fi goes down at 3am");
        require(factory.coinCount() == 1, "count");
        require(keccak256(bytes(ProphecyCoin(coin).prophecy())) == keccak256("The Wi-Fi goes down at 3am"), "text");
        require(ProphecyCoin(coin).creator() == address(this), "creator");
    }
}
