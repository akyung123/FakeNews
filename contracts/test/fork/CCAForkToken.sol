// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Plain 18-decimal ERC-20 for the CCA fork spike. Not ProphecyToken — the
/// official auction is happier with a 1_000e18 supply than a 1e9 × 1e18 mint.
contract CCAForkToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error TransferFailed();

    constructor(string memory name_, string memory symbol_, uint256 supply, address mintTo) {
        name = name_;
        symbol = symbol_;
        totalSupply = supply;
        balanceOf[mintTo] = supply;
        emit Transfer(address(0), mintTo, supply);
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _move(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < value) revert TransferFailed();
            allowance[from][msg.sender] = allowed - value;
        }
        _move(from, to, value);
        return true;
    }

    function _move(address from, address to, uint256 value) internal {
        if (to == address(0) || balanceOf[from] < value) revert TransferFailed();
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}
