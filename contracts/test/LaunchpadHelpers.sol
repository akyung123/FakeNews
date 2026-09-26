// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";

import {IProphecyEns} from "../src/ens/IProphecyEns.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {LiquidityLocker} from "../src/uniswap/LiquidityLocker.sol";
import {MockLBPStrategy, MockPositionManager} from "./mocks/MockCca.sol";

/// Minimal ENS adapter for World-signature and CCA launch tests.
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

contract MockAuthorizedHook {
    address public authorized;

    constructor(address authorized_) {
        authorized = authorized_;
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
    MockLBPStrategy internal mockStrategy;
    MockPositionManager internal mockPosm;
    LiquidityLocker internal mockLocker;
    uint256 internal nextNullifier = 1;

    function _deployLaunchpad() internal {
        signer = vm.addr(SIGNER_PK);
        mockEns = new MockProphecyEns();
        launchpad = new Launchpad(protocol, signer, IProphecyEns(address(mockEns)));
        _wireCcaMocks(launchpad);
    }

    function _newLaunchpad(address protocol_, address signer_) internal returns (Launchpad pad) {
        pad = new Launchpad(protocol_, signer_, IProphecyEns(address(new MockProphecyEns())));
        _wireCcaMocks(pad);
    }

    function _wireCcaMocks(Launchpad pad) internal {
        mockStrategy = new MockLBPStrategy();
        mockPosm = new MockPositionManager();
        address dummyPm = address(uint160(0xB001));
        address dummyHook = address(new MockAuthorizedHook(address(mockStrategy)));
        mockLocker = new LiquidityLocker(IPoolManager(dummyPm), address(pad), IHooks(dummyHook));
        pad.setUniswap(IPoolManager(dummyPm), dummyHook, address(mockLocker));
        pad.setCca(address(mockStrategy), address(mockPosm));
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
        token = pad.launch(slug, "a prophecy sentence");
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
}
