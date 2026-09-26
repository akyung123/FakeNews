// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DnsCodec} from "../src/ens/DnsCodec.sol";
import {
    IPermissionedRegistry,
    IPermissionedResolver,
    IVerifiableFactory,
    ROLE_LINK,
    ROLE_RESOLVER_UPGRADE,
    ROLE_SET_TEXT,
    ROLE_SET_TEXT_ADMIN,
    ROLE_UNREGISTER,
    ROOT_RESOURCE
} from "../src/ens/EnsV2.sol";
import {ProphecyEns} from "../src/ens/ProphecyEns.sol";
import {Grant, ROLE_REGISTRAR} from "../src/ens/EnsV2.sol";
import {LockActor, LockFactory, LockRegistry, LockResolver} from "./LockMock.sol";

/// Acceptance: sentence, transfer, resolver, and UNREGISTER stay locked;
/// `slug.name.prophecy.eth` resolves to the token.
contract LockTest {
    ProphecyEns internal ens;
    LockRegistry internal parent;
    LockFactory internal factory;
    LockActor internal prophet;
    address internal token;
    bytes internal parentDns;

    string internal constant PROPHET = "ringo";
    string internal constant SLUG = "badges-2028";
    string internal constant SENTENCE = "Every hackathon badge is an ENS name by 2028";

    function setUp() public {
        parentDns = abi.encodePacked(uint8(8), bytes("prophecy"), uint8(3), bytes("eth"), bytes1(0));
        LockRegistry registryKind = new LockRegistry();
        LockResolver resolverKind = new LockResolver();
        factory = new LockFactory(address(registryKind), address(resolverKind));
        parent = new LockRegistry();
        prophet = new LockActor();
        token = address(0xCAFE);
        ens = new ProphecyEns(
            address(this),
            IPermissionedRegistry(address(parent)),
            parentDns,
            IVerifiableFactory(address(factory)),
            address(registryKind),
            address(resolverKind)
        );
        Grant[] memory grants = new Grant[](1);
        grants[0] = Grant({account: address(ens), roleBitmap: ROLE_REGISTRAR});
        parent.initialize(grants);
    }

    function test_editSentenceReverts() public {
        (, address prophecyResolver) = _launch();
        bytes memory name = _prophecyDns();
        try prophet.setText(prophecyResolver, name, "prophecy", "rewritten") {
            revert("sentence edit should revert");
        } catch (bytes memory err) {
            require(
                bytes4(err) == IPermissionedResolver.EACUnauthorizedAccountRoles.selector,
                "EACUnauthorizedAccountRoles"
            );
        }
        try prophet.setText(prophecyResolver, name, "deadline", "1") {
            revert("deadline edit should revert");
        } catch (bytes memory err) {
            require(
                bytes4(err) == IPermissionedResolver.EACUnauthorizedAccountRoles.selector,
                "deadline EAC"
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
                uint256(keccak256(bytes("deadline"))), ROLE_SET_TEXT
            ),
            "deadline key"
        );
        require(
            !IPermissionedResolver(prophecyResolver).hasAssignees(
                ROOT_RESOURCE, ROLE_SET_TEXT | ROLE_SET_TEXT_ADMIN | ROLE_LINK | ROLE_RESOLVER_UPGRADE
            ),
            "resolver root writers"
        );
        require(
            !IPermissionedResolver(prophecyResolver).hasRoles(
                ROOT_RESOURCE, ROLE_SET_TEXT_ADMIN, address(ens)
            ),
            "adapter text admin"
        );
    }

    function test_transferNameReverts() public {
        _launch();
        uint256 prophetId = uint256(keccak256(bytes(PROPHET)));
        try prophet.transferName(address(parent), prophetId, address(0xBEEF)) {
            revert("transfer should revert");
        } catch (bytes memory err) {
            require(bytes4(err) == IPermissionedRegistry.TransferDisallowed.selector, "TransferDisallowed");
        }

        uint256 slugId = uint256(keccak256(bytes(SLUG)));
        address prophetRegistry = address(parent.getSubregistry(PROPHET));
        try prophet.transferName(prophetRegistry, slugId, address(0xBEEF)) {
            revert("slug transfer should revert");
        } catch (bytes memory err) {
            require(bytes4(err) == IPermissionedRegistry.TransferDisallowed.selector, "TransferDisallowed slug");
        }
    }

    function test_replaceResolverReverts() public {
        _launch();
        uint256 prophetId = uint256(keccak256(bytes(PROPHET)));
        try prophet.setResolver(address(parent), prophetId, address(0xB0B)) {
            revert("setResolver should revert");
        } catch (bytes memory err) {
            require(
                bytes4(err) == IPermissionedRegistry.EACUnauthorizedAccountRoles.selector,
                "setResolver"
            );
        }

        address prophetRegistry = address(parent.getSubregistry(PROPHET));
        uint256 slugId = uint256(keccak256(bytes(SLUG)));
        try prophet.setResolver(prophetRegistry, slugId, address(0xB0B)) {
            revert("slug setResolver should revert");
        } catch (bytes memory err) {
            require(
                bytes4(err) == IPermissionedRegistry.EACUnauthorizedAccountRoles.selector,
                "slug setResolver"
            );
        }

        try prophet.setSubregistry(address(parent), prophetId, address(0xB0B)) {
            revert("setSubregistry should revert");
        } catch (bytes memory err) {
            require(
                bytes4(err) == IPermissionedRegistry.EACUnauthorizedAccountRoles.selector,
                "setSubregistry"
            );
        }
    }

    function test_hasAssigneesRootUnregisterFalse() public {
        _launch();
        require(!parent.hasAssignees(ROOT_RESOURCE, ROLE_UNREGISTER), "parent UNREGISTER");
        LockRegistry prophetRegistry = LockRegistry(address(parent.getSubregistry(PROPHET)));
        require(!prophetRegistry.hasAssignees(ROOT_RESOURCE, ROLE_UNREGISTER), "prophet UNREGISTER");
        require(prophetRegistry.isEmancipated(), "prophet emancipated");
        uint256 prophetId = uint256(keccak256(bytes(PROPHET)));
        require(parent.getState(prophetId).expiry == type(uint64).max, "prophet expiry");
        require(parent.ownerRoles(prophetId) == 0, "prophet owner roles");
        uint256 slugId = uint256(keccak256(bytes(SLUG)));
        require(prophetRegistry.getState(slugId).expiry == type(uint64).max, "slug expiry");
        require(prophetRegistry.ownerRoles(slugId) == 0, "slug owner roles");
    }

    function test_slugResolvesToToken() public {
        (address prophetResolver, address prophecyResolver) = _launch();

        address got = _addr(prophecyResolver, _prophecyDns());
        require(got == token, "token address");

        string memory sentence = _text(prophecyResolver, _prophecyDns(), "prophecy");
        require(keccak256(bytes(sentence)) == keccak256(bytes(SENTENCE)), "sentence");

        string memory deadline = _text(prophecyResolver, _prophecyDns(), "deadline");
        require(keccak256(bytes(deadline)) == keccak256(bytes("1893456000")), "deadline");

        address wallet = _addr(prophetResolver, DnsCodec.join(PROPHET, parentDns));
        require(wallet == address(prophet), "prophet wallet");
    }

    function test_displayKeyStillWritable() public {
        (, address prophecyResolver) = _launch();
        prophet.setText(prophecyResolver, _prophecyDns(), "avatar", "ipfs://ok");
        string memory avatar = _text(prophecyResolver, _prophecyDns(), "avatar");
        require(keccak256(bytes(avatar)) == keccak256(bytes("ipfs://ok")), "avatar");
    }

    function _launch() internal returns (address prophetResolver, address prophecyResolver) {
        (, prophetResolver) = ens.registerProphet(PROPHET, address(prophet));
        prophecyResolver = ens.registerProphecy(PROPHET, SLUG, SENTENCE, 1893456000, token);
    }

    function _prophecyDns() internal view returns (bytes memory) {
        return DnsCodec.join(SLUG, DnsCodec.join(PROPHET, parentDns));
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
