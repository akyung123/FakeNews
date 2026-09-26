// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DnsCodec} from "../src/ens/DnsCodec.sol";
import {
    Grant,
    IPermissionedRegistry,
    IPermissionedResolver,
    IVerifiableFactory,
    ROLE_LINK,
    ROLE_REGISTRAR,
    ROLE_RESOLVER_UPGRADE,
    ROLE_SET_TEXT,
    ROLE_SET_TEXT_ADMIN,
    ROLE_UNREGISTER,
    ROOT_RESOURCE
} from "../src/ens/EnsV2.sol";
import {IProphecyEns} from "../src/ens/IProphecyEns.sol";
import {ProphecyEns} from "../src/ens/ProphecyEns.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {ProphecyToken} from "../src/ProphecyToken.sol";
import {LockActor, LockFactory, LockRegistry, LockResolver} from "./LockMock.sol";
import {LaunchpadTestBase, MockProphecyEns} from "./LaunchpadHelpers.sol";

/// Launchpad → ProphecyEns: sentence written at init only, name lock holds.
contract LaunchpadEnsTest is LaunchpadTestBase {
    ProphecyEns internal realEns;
    LockRegistry internal parent;
    LockFactory internal factory;
    LockActor internal actor;
    bytes internal parentDns;

    string internal constant PROPHET = "ringo";
    string internal constant SLUG = "badges-2028";
    string internal constant SENTENCE = "Every hackathon badge is an ENS name by 2028";
    uint64 internal constant DEADLINE = 1893456000;

    event Launched(address indexed token, address indexed prophet, string prophetLabel, string slug);

    function setUp() public {
        signer = vm.addr(SIGNER_PK);
        parentDns = abi.encodePacked(uint8(8), bytes("prophecy"), uint8(3), bytes("eth"), bytes1(0));
        LockRegistry registryKind = new LockRegistry();
        LockResolver resolverKind = new LockResolver();
        factory = new LockFactory(address(registryKind), address(resolverKind));
        parent = new LockRegistry();
        actor = new LockActor();
        vm.deal(address(actor), 10 ether);

        // First Launchpad deploy also links CurveMath; do that before predicting.
        new Launchpad(protocol, signer, IProphecyEns(address(new MockProphecyEns())));

        uint64 nonce = vm.getNonce(address(this));
        address predictedPad = vm.computeCreateAddress(address(this), nonce + 1);
        realEns = new ProphecyEns(
            predictedPad,
            IPermissionedRegistry(address(parent)),
            parentDns,
            IVerifiableFactory(address(factory)),
            address(registryKind),
            address(resolverKind)
        );
        launchpad = new Launchpad(protocol, signer, IProphecyEns(address(realEns)));
        require(address(launchpad) == predictedPad, "launchpad address");

        Grant[] memory grants = new Grant[](1);
        grants[0] = Grant({account: address(realEns), roleBitmap: ROLE_REGISTRAR});
        parent.initialize(grants);
    }

    function test_launchRegistersFullNameAndLocksSentence() public {
        _registerActor();
        address predictedToken = vm.computeCreateAddress(address(launchpad), vm.getNonce(address(launchpad)));
        vm.expectEmit(true, true, false, true, address(launchpad));
        emit Launched(predictedToken, address(actor), PROPHET, SLUG);

        vm.prank(address(actor));
        address token = launchpad.launch(SLUG, SENTENCE, DEADLINE, 0);

        assertEq(token, predictedToken);
        assertEq(ProphecyToken(token).name(), "badges-2028.ringo.prophecy.eth");
        assertEq(launchpad.prophetOf(address(actor)), PROPHET);

        address prophecyResolver = parent.getSubregistry(PROPHET).getResolver(SLUG);
        bytes memory name = DnsCodec.join(SLUG, DnsCodec.join(PROPHET, parentDns));
        assertEq(_text(prophecyResolver, name, "prophecy"), SENTENCE);
        assertEq(_text(prophecyResolver, name, "deadline"), "1893456000");
        assertEq(_addr(prophecyResolver, name), token);

        try actor.setText(prophecyResolver, name, "prophecy", "rewritten") {
            revert("sentence edit should revert");
        } catch (bytes memory err) {
            require(
                bytes4(err) == IPermissionedResolver.EACUnauthorizedAccountRoles.selector,
                "EACUnauthorizedAccountRoles"
            );
        }

        require(
            !IPermissionedResolver(prophecyResolver).hasAssignees(
                uint256(keccak256(bytes("prophecy"))), ROLE_SET_TEXT
            ),
            "prophecy key"
        );
        require(
            !IPermissionedResolver(prophecyResolver).hasAssignees(
                ROOT_RESOURCE, ROLE_SET_TEXT | ROLE_SET_TEXT_ADMIN | ROLE_LINK | ROLE_RESOLVER_UPGRADE
            ),
            "resolver root writers"
        );

        IPermissionedRegistry prophetRegistry = IPermissionedRegistry(address(parent.getSubregistry(PROPHET)));
        require(prophetRegistry.isEmancipated(), "prophet emancipated");
        require(!prophetRegistry.hasAssignees(ROOT_RESOURCE, ROLE_UNREGISTER), "prophet UNREGISTER");
        require(parent.getState(uint256(keccak256(bytes(PROPHET)))).expiry == type(uint64).max, "expiry");
    }

    function test_launchByNonProphetReverts() public {
        vm.expectRevert(Launchpad.NotProphet.selector);
        launchpad.launch(SLUG, SENTENCE, DEADLINE, 0);
    }

    function test_reusedSlugReverts() public {
        _registerActor();
        vm.prank(address(actor));
        launchpad.launch(SLUG, SENTENCE, DEADLINE, 0);
        vm.prank(address(actor));
        vm.expectRevert(Launchpad.SlugTaken.selector);
        launchpad.launch(SLUG, "a different sentence", DEADLINE, 0);
    }

    function _registerActor() internal {
        vm.prank(address(actor));
        launchpad.registerProphet(PROPHET, 1, _sign(address(actor), 1));
    }

    function _addr(address resolver, bytes memory name) internal view returns (address) {
        bytes memory out =
            IPermissionedResolver(resolver).resolve(name, abi.encodeWithSignature("addr(bytes32)", bytes32(0)));
        return abi.decode(out, (address));
    }

    function _text(address resolver, bytes memory name, string memory key)
        internal
        view
        returns (string memory)
    {
        bytes memory out = IPermissionedResolver(resolver).resolve(
            name, abi.encodeWithSignature("text(bytes32,string)", bytes32(0), key)
        );
        return abi.decode(out, (string));
    }
}
