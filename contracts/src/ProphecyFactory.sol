// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ProphecyCoin} from "./ProphecyCoin.sol";

/// Launches one ProphecyCoin per prophecy. Skeleton — logic is written at the event.
contract ProphecyFactory {
    event ProphecyLaunched(address indexed coin, address indexed creator, string name, string symbol, string prophecy);

    address[] public coins;

    function createCoin(string calldata name, string calldata symbol, string calldata prophecy)
        external
        returns (address coin)
    {
        coin = address(new ProphecyCoin(name, symbol, prophecy, msg.sender));
        coins.push(coin);
        emit ProphecyLaunched(coin, msg.sender, name, symbol, prophecy);
    }

    function coinCount() external view returns (uint256) {
        return coins.length;
    }
}
