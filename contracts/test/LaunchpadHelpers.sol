// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {IProphecyEns} from "../src/ens/IProphecyEns.sol";
import {Launchpad} from "../src/Launchpad.sol";

/// Minimal ENS adapter for curve and World-signature tests.
contract MockProphecyEns is IProphecyEns {
    error UnknownProphet();
    error InvalidSlug();

    mapping(string => address) public walletOf;
    mapping(bytes32 => bool) public slugUsed;

    function registerProphet(string calldata label, address wallet)
        external
        returns (address registry, address resolver)
    {
        walletOf[label] = wallet;
        registry = address(uint160(1));
        resolver = address(uint160(2));
        emit ProphetNameCreated(wallet, label, registry, resolver);
    }

    function registerProphecy(
        string calldata prophetLabel,
        string calldata slug,
        string calldata,
        uint64,
        address token
    ) external returns (address resolver) {
        if (walletOf[prophetLabel] == address(0)) revert UnknownProphet();
        bytes32 key = keccak256(abi.encode(prophetLabel, slug));
        if (slugUsed[key]) revert InvalidSlug();
        slugUsed[key] = true;
        resolver = address(uint160(3));
        emit ProphecyNameCreated(token, prophetLabel, slug, resolver);
    }
}

abstract contract LaunchpadTestBase is Test {
    uint256 internal constant SIGNER_PK =
        0x51C51C51C51C51C51C51C51C51C51C51C51C51C51C51C51C51C51C51C51C51C5;

    address internal protocol = address(0xFEE);
    address internal signer;
    address internal prophet = address(0xA11CE);
    address internal buyer = address(0xB0B);
    MockProphecyEns internal mockEns;
    Launchpad internal launchpad;
    uint256 internal nextNullifier = 1;

    function _deployLaunchpad() internal {
        signer = vm.addr(SIGNER_PK);
        mockEns = new MockProphecyEns();
        launchpad = new Launchpad(protocol, signer, IProphecyEns(address(mockEns)));
    }

    function _newLaunchpad(address protocol_, address signer_) internal returns (Launchpad pad) {
        pad = new Launchpad(protocol_, signer_, IProphecyEns(address(new MockProphecyEns())));
    }

    function worldDigest(address pad, address wallet, uint256 nullifier, uint256 chainId)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(chainId, pad, wallet, nullifier));
    }

    function signRegister(address pad, address wallet, uint256 nullifier, uint256 chainId, uint256 pk)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = worldDigest(pad, wallet, nullifier, chainId);
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(pk, keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)));
        return abi.encodePacked(r, s, v);
    }

    function _sign(address wallet, uint256 nullifier) internal view returns (bytes memory) {
        return signRegister(address(launchpad), wallet, nullifier, block.chainid, SIGNER_PK);
    }

    function _registerProphetOn(Launchpad pad, address wallet, string memory label) internal {
        uint256 n = nextNullifier++;
        vm.prank(wallet);
        pad.registerProphet(label, n, signRegister(address(pad), wallet, n, block.chainid, SIGNER_PK));
    }

    function _registerProphet(address wallet, string memory label) internal {
        _registerProphetOn(launchpad, wallet, label);
    }

    function _launchOn(Launchpad pad, address wallet, string memory slug) internal returns (address token) {
        vm.prank(wallet);
        token = pad.launch(slug, "a prophecy sentence", 1_800_000_000, 0);
    }

    function _launch(string memory slug) internal returns (address token) {
        return _launchOn(launchpad, prophet, slug);
    }

    function _registerAndLaunch() internal returns (address token) {
        _registerProphet(prophet, "ringo");
        return _launch("lingo-2028");
    }

    function _registerAndLaunchAs(address wallet, string memory label, string memory slug)
        internal
        returns (address token)
    {
        _registerProphet(wallet, label);
        return _launchOn(launchpad, wallet, slug);
    }

    function _sellOutOn(Launchpad pad, address trader, address token) internal {
        vm.prank(trader);
        pad.buy{value: 1 ether}(token, 0, "");
    }

    /// Last-curve buy: fills remaining supply and graduates when Uniswap is set.
    function _sellOut(address token) internal {
        _sellOutOn(launchpad, buyer, token);
    }
}
