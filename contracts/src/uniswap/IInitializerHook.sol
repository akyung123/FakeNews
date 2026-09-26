// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Official liquidity-launcher `IInitializerHook` (ERC165 id is `authorized()` only).
/// https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/interfaces/IInitializerHook.sol
interface IInitializerHook {
    function authorized() external view returns (address);
}
