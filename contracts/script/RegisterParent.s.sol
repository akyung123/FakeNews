// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SepoliaConfig} from "./SepoliaConfig.sol";
import {ScriptVm} from "./ScriptVm.sol";

/// Minimal ETHRegistrar surface from contracts-v2 `71a3b73` (docs/ENSV2.md section 6).
interface IETHRegistrar {
    function commit(bytes32 commitment) external;

    function register(
        string memory label,
        address owner,
        bytes32 secret,
        address subregistry,
        address resolver,
        uint64 duration,
        address paymentToken,
        bytes32 referrer
    ) external returns (uint256);

    function makeCommitment(
        string calldata label,
        address owner,
        bytes32 secret,
        address subregistry,
        address resolver,
        uint64 duration,
        bytes32 referrer
    ) external pure returns (bytes32);

    function isAvailable(string memory label) external view returns (bool);

    function commitmentAt(bytes32 commitment) external view returns (uint64);

    function getRegisterPrice(string calldata label, uint64 duration, address paymentToken)
        external
        view
        returns (uint256 base, uint256 premium);
}

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// Register the parent label (`prophecy`) on Sepolia ENSv2.
/// Split into two script runs: forge simulates a run before sending, so a
/// single script cannot wait 60s between commit and register.
///
///   ./script/run-sepolia.sh script/RegisterParent.s.sol --sig "commit()"
///   # wait ~70s (or warp on a local fork)
///   ./script/run-sepolia.sh script/RegisterParent.s.sol --sig "fundPaymentToken()"
///   ./script/run-sepolia.sh script/RegisterParent.s.sol --sig "registerName()"
///
/// TEAM_WALLET defaults to the deployer. A different value reverts.
contract RegisterParent is ScriptVm {
    event Commitment(string label, address owner, bytes32 commitment);
    event Funded(address token, address to, uint256 amount, bool minted);

    function commit() external {
        (string memory label, address owner, bytes32 secret, uint64 duration) = _params();
        IETHRegistrar registrar = IETHRegistrar(SepoliaConfig.ETH_REGISTRAR);

        require(registrar.isAvailable(label), "label not available");
        bytes32 commitment =
            registrar.makeCommitment(label, owner, secret, address(0), address(0), duration, bytes32(0));

        emit Commitment(label, owner, commitment);

        _start();
        registrar.commit(commitment);
        vm.stopBroadcast();
    }

    /// Public mint on the 71a3b73 MockUSDC (`mint(address,uint256)`, 6 decimals).
    /// If mint is missing or reverts, require the deployer already holds enough.
    function fundPaymentToken() external {
        (string memory label, address owner,, uint64 duration) = _params();
        IERC20 usdc = IERC20(SepoliaConfig.MOCK_USDC);
        uint256 amount = _mintAmount(label, duration);

        _start();
        bool minted = _mintIfNeeded(usdc, owner, amount);
        vm.stopBroadcast();

        emit Funded(address(usdc), owner, amount, minted);
        _pasteLine(string.concat("MOCK_USDC_BALANCE_TARGET=", vm.toString(amount)));
    }

    function registerName() external {
        (string memory label, address owner, bytes32 secret, uint64 duration) = _params();
        IETHRegistrar registrar = IETHRegistrar(SepoliaConfig.ETH_REGISTRAR);
        IERC20 usdc = IERC20(SepoliaConfig.MOCK_USDC);

        bytes32 commitment =
            registrar.makeCommitment(label, owner, secret, address(0), address(0), duration, bytes32(0));
        uint64 committedAt = registrar.commitmentAt(commitment);
        require(committedAt != 0, "commit first");
        require(block.timestamp >= uint256(committedAt) + 60, "wait 60s after commit");

        uint256 amount = _mintAmount(label, duration);

        _start();
        _mintIfNeeded(usdc, owner, amount);
        // MockUSDC.approve(ETHRegistrar) then register(..., subregistry=0, resolver=0).
        usdc.approve(address(registrar), type(uint256).max);
        registrar.register(label, owner, secret, address(0), address(0), duration, address(usdc), bytes32(0));
        vm.stopBroadcast();
    }

    function _params() internal view returns (string memory label, address owner, bytes32 secret, uint64 duration) {
        require(block.chainid == SepoliaConfig.CHAIN_ID || block.chainid == 31337, "sepolia or anvil only");
        label = vm.envOr("PARENT_LABEL", string("prophecy"));
        owner = _teamWallet();
        secret = vm.envOr("ENS_REGISTRATION_SECRET", bytes32(0));
        duration = uint64(vm.envOr("ENS_DURATION_SECONDS", uint256(365 days)));
        require(bytes(label).length >= 5, "label must be 5+ chars on .eth");
        require(secret != bytes32(0), "set ENS_REGISTRATION_SECRET");
    }

    function _mintAmount(string memory label, uint64 duration) internal view returns (uint256 amount) {
        amount = vm.envOr("MOCK_USDC_MINT_AMOUNT", uint256(0));
        if (amount != 0) return amount;
        (uint256 base, uint256 premium) =
            IETHRegistrar(SepoliaConfig.ETH_REGISTRAR).getRegisterPrice(label, duration, SepoliaConfig.MOCK_USDC);
        amount = base + premium;
        if (amount == 0) amount = 8_000_000;
        // Headroom so a second attempt or premium bump still clears.
        amount *= 2;
    }

    function _mintIfNeeded(IERC20 usdc, address to, uint256 amount) internal returns (bool minted) {
        if (usdc.balanceOf(to) >= amount) return false;
        (bool ok,) = address(usdc).call(abi.encodeWithSignature("mint(address,uint256)", to, amount));
        if (ok && usdc.balanceOf(to) >= amount) return true;
        require(usdc.balanceOf(to) >= amount, "MockUSDC has no public mint; fund TEAM_WALLET before register");
    }
}
