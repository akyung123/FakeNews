// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IProphecyEns} from "../src/ens/IProphecyEns.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {ProphecyToken} from "../src/ProphecyToken.sol";
import {LaunchpadTestBase} from "./LaunchpadHelpers.sol";

/// World ID server signature, nullifier, and label/slug uniqueness.
contract LaunchpadWorldTest is LaunchpadTestBase {
    // world/fixture/register-prophet-signature.json — encoding only.
    uint256 internal constant FIXTURE_CHAIN_ID = 11155111;
    address internal constant FIXTURE_LAUNCHPAD = 0x1111111111111111111111111111111111111111;
    address internal constant FIXTURE_WALLET = 0x2222222222222222222222222222222222222222;
    uint256 internal constant FIXTURE_NULLIFIER =
        0x2bf8406809dcefb1486dadc96c0a897db9bab002053054cf64272db512c6fbd8;
    bytes32 internal constant FIXTURE_PAYLOAD =
        0x8e56ae8e851d75918c1282f4898f87a8e68c43f87cab694125679d52d5901e2b;
    bytes32 internal constant FIXTURE_EIP191 =
        0x9797883e5663b08391f64260692aae96c4be23ac26341f3bff31293446e663fe;
    bytes internal constant FIXTURE_SIG =
        hex"30b81b87f692058fe903c62e6658079e5ed5d399b0498408232b8d1fcc6fde907fb7fad72e0b1e482806e53d0b29ec8a2c766251dceef6e448a9772a2c5c0a801c";
    address internal constant FIXTURE_SIGNER = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

    event ProphetRegistered(address indexed wallet, string label, uint256 nullifier);
    event Launched(address indexed token, address indexed prophet, string prophetLabel, string slug);

    function setUp() public {
        _deployLaunchpad();
        vm.deal(prophet, 100 ether);
        vm.deal(buyer, 100 ether);
    }

    function test_worldFixtureMatchesEncodeTs() public pure {
        bytes32 digest = keccak256(
            abi.encode(FIXTURE_CHAIN_ID, FIXTURE_LAUNCHPAD, FIXTURE_WALLET, FIXTURE_NULLIFIER)
        );
        assertEq(digest, FIXTURE_PAYLOAD);
        assertEq(keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)), FIXTURE_EIP191);

        bytes memory sig = FIXTURE_SIG;
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        address recovered = ecrecover(FIXTURE_EIP191, v, r, s);
        assertEq(recovered, FIXTURE_SIGNER);
    }

    function test_registerProphetHappyPath() public {
        uint256 nullifier = 7;
        vm.expectEmit(true, false, false, true, address(launchpad));
        emit ProphetRegistered(prophet, "ringo", nullifier);
        vm.prank(prophet);
        launchpad.registerProphet("ringo", nullifier, _sign(prophet, nullifier));
        assertEq(launchpad.prophetOf(prophet), "ringo");
        assertEq(mockEns.walletOf("ringo"), prophet);
    }

    function test_wrongSignerReverts() public {
        uint256 otherPk = uint256(keccak256("other-signer"));
        bytes memory sig =
            signRegister(address(launchpad), prophet, 1, block.chainid, otherPk);
        vm.prank(prophet);
        vm.expectRevert(Launchpad.InvalidSignature.selector);
        launchpad.registerProphet("ringo", 1, sig);
    }

    function test_wrongChainIdReverts() public {
        bytes memory sig = signRegister(address(launchpad), prophet, 1, 1, SIGNER_PK);
        vm.prank(prophet);
        vm.expectRevert(Launchpad.InvalidSignature.selector);
        launchpad.registerProphet("ringo", 1, sig);
    }

    function test_wrongLaunchpadReverts() public {
        bytes memory sig = signRegister(address(0xBEEF), prophet, 1, block.chainid, SIGNER_PK);
        vm.prank(prophet);
        vm.expectRevert(Launchpad.InvalidSignature.selector);
        launchpad.registerProphet("ringo", 1, sig);
    }

    function test_reusedNullifierReverts() public {
        _registerProphet(prophet, "ringo");
        bytes memory sig = _sign(buyer, 1);
        vm.prank(buyer);
        vm.expectRevert(Launchpad.NullifierUsed.selector);
        launchpad.registerProphet("mina", 1, sig);
    }

    function test_reusedLabelReverts() public {
        _registerProphet(prophet, "ringo");
        vm.prank(buyer);
        vm.expectRevert(Launchpad.LabelTaken.selector);
        launchpad.registerProphet("ringo", 2, _sign(buyer, 2));
    }

    function test_invalidLabelReverts() public {
        vm.prank(prophet);
        vm.expectRevert(Launchpad.BadLabel.selector);
        launchpad.registerProphet("ab", 1, _sign(prophet, 1));
    }

    function test_launchByNonProphetReverts() public {
        vm.prank(buyer);
        vm.expectRevert(Launchpad.NotProphet.selector);
        launchpad.launch("lingo-2028", "a prophecy sentence", 1_800_000_000, 0);
    }

    function test_reusedSlugReverts() public {
        _registerAndLaunch();
        vm.prank(prophet);
        vm.expectRevert(Launchpad.SlugTaken.selector);
        launchpad.launch("lingo-2028", "another sentence here", 1_800_000_001, 0);
    }

    function test_sameSlugDifferentProphetsOk() public {
        _registerProphet(prophet, "ringo");
        _registerProphet(buyer, "mina");
        address a = _launch("lingo-2028");
        vm.prank(buyer);
        address b = launchpad.launch("lingo-2028", "a prophecy sentence", 1_800_000_000, 0);
        assertTrue(a != b);
        assertEq(ProphecyToken(a).name(), "lingo-2028.ringo.prophecy.eth");
        assertEq(ProphecyToken(b).name(), "lingo-2028.mina.prophecy.eth");
    }

    function test_tokenNameIsFullEnsName() public {
        address token = _registerAndLaunch();
        assertEq(ProphecyToken(token).name(), "lingo-2028.ringo.prophecy.eth");
        assertEq(ProphecyToken(token).symbol(), "LINGO-2028");
    }

    function test_launchedEventCarriesProphetLabel() public {
        _registerProphet(prophet, "ringo");
        address predicted = vm.computeCreateAddress(address(launchpad), vm.getNonce(address(launchpad)));
        vm.expectEmit(true, true, false, true, address(launchpad));
        emit Launched(predicted, prophet, "ringo", "lingo-2028");
        _launch("lingo-2028");
    }

    function test_constructorRejectsZeroEns() public {
        vm.expectRevert(Launchpad.ZeroAddress.selector);
        new Launchpad(protocol, signer, IProphecyEns(address(0)));
    }
}
