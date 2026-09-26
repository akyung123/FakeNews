// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DnsCodec} from "../src/ens/DnsCodec.sol";
import {
    Grant,
    IPermissionedRegistry,
    IPermissionedResolver,
    IUserRegistryInit,
    IVerifiableFactory,
    ROLE_REGISTRAR,
    ROLE_REGISTRAR_ADMIN,
    ROLE_UNREGISTER,
    ROOT_RESOURCE
} from "../src/ens/EnsV2.sol";
import {ProphecyEns} from "../src/ens/ProphecyEns.sol";

// Sepolia ENSv2 (`71a3b73`) from docs/ENSV2.md section 0.
address constant SEPOLIA_FACTORY = 0x9e726Eb570beb6BCEb495AB8cdA7df517d4e841C;
address constant SEPOLIA_USER_REGISTRY_IMPL = 0xA80338aAA8D23831cEa25E858D1774534aBb0263;
address constant SEPOLIA_RESOLVER_IMPL = 0x14F09Fd05d4585759e54844DC9B00147131Cf243;

interface Vm {
    function envOr(string calldata name, string calldata defaultValue)
        external
        view
        returns (string memory);
    function createSelectFork(string calldata url) external returns (uint256);
    function skip(bool skipTest) external;
}

/// Prophet-controlled caller against real registry/resolver ABIs.
contract LockRealActor {
    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x4e2312e0 || interfaceId == 0x01ffc9a7;
    }

    function transferName(IPermissionedRegistry registry, uint256 tokenId, address to) external {
        registry.safeTransferFrom(address(this), to, tokenId, 1, "");
    }

    function setText(IPermissionedResolver resolver, bytes calldata name, string calldata key, string calldata value)
        external
    {
        resolver.setText(name, key, value);
    }

    function setResolver(IPermissionedRegistry registry, uint256 anyId, address next) external {
        registry.setResolver(anyId, next);
    }
}

/// Lock proof on the official Sepolia impls. Skips when `SEPOLIA_RPC_URL` is unset.
contract LockRealTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ProphecyEns internal ens;
    IPermissionedRegistry internal parent;
    LockRealActor internal prophet;
    address internal token;
    bytes internal parentDns;
    bool internal forked;

    string internal constant PROPHET = "ringo";
    string internal constant SLUG = "badges-2028";
    string internal constant SENTENCE = "Every hackathon badge is an ENS name by 2028";

    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function setUp() public {
        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        forked = true;

        parentDns = abi.encodePacked(uint8(8), bytes("prophecy"), uint8(3), bytes("eth"), bytes1(0));
        prophet = new LockRealActor();
        token = address(0xCAFE);

        Grant[] memory grants = new Grant[](1);
        grants[0] = Grant({
            account: address(this),
            roleBitmap: ROLE_REGISTRAR | ROLE_REGISTRAR_ADMIN
        });
        parent = IPermissionedRegistry(
            IVerifiableFactory(SEPOLIA_FACTORY).deployProxy(
                SEPOLIA_USER_REGISTRY_IMPL,
                uint256(keccak256("prophecy-parent")),
                abi.encodeCall(IUserRegistryInit.initialize, (grants))
            )
        );

        ens = new ProphecyEns(
            address(this),
            parent,
            parentDns,
            IVerifiableFactory(SEPOLIA_FACTORY),
            SEPOLIA_USER_REGISTRY_IMPL,
            SEPOLIA_RESOLVER_IMPL
        );
        require(parent.grantRootRoles(ROLE_REGISTRAR, address(ens)));
    }

    function test_real_editSentenceReverts() public {
        _needFork();
        (, address prophecyResolver) = _launch();
        try prophet.setText(
            IPermissionedResolver(prophecyResolver), _prophecyDns(), "prophecy", "rewritten"
        ) {
            revert("sentence edit should revert");
        } catch (bytes memory err) {
            require(
                bytes4(err) == IPermissionedResolver.EACUnauthorizedAccountRoles.selector,
                "EACUnauthorizedAccountRoles"
            );
        }
    }

    function test_real_transferNameReverts() public {
        _needFork();
        _launch();
        uint256 prophetId = parent.getState(uint256(keccak256(bytes(PROPHET)))).tokenId;
        try prophet.transferName(parent, prophetId, address(0xBEEF)) {
            revert("transfer should revert");
        } catch (bytes memory err) {
            require(bytes4(err) == IPermissionedRegistry.TransferDisallowed.selector, "TransferDisallowed");
        }
    }

    function test_real_replaceResolverReverts() public {
        _needFork();
        _launch();
        uint256 prophetId = parent.getState(uint256(keccak256(bytes(PROPHET)))).tokenId;
        try prophet.setResolver(parent, prophetId, address(0xB0B)) {
            revert("setResolver should revert");
        } catch (bytes memory err) {
            require(
                bytes4(err) == IPermissionedRegistry.EACUnauthorizedAccountRoles.selector, "setResolver"
            );
        }
    }

    function test_real_hasAssigneesRootUnregisterFalse() public {
        _needFork();
        _launch();
        require(!parent.hasAssignees(ROOT_RESOURCE, ROLE_UNREGISTER), "parent UNREGISTER");
        IPermissionedRegistry prophetRegistry = IPermissionedRegistry(address(parent.getSubregistry(PROPHET)));
        require(!prophetRegistry.hasAssignees(ROOT_RESOURCE, ROLE_UNREGISTER), "prophet UNREGISTER");
        require(prophetRegistry.isEmancipated(), "prophet emancipated");
    }

    function _needFork() internal {
        if (!forked) vm.skip(true);
    }

    function _launch() internal returns (address prophetResolver, address prophecyResolver) {
        (, prophetResolver) = ens.registerProphet(PROPHET, address(prophet));
        prophecyResolver = ens.registerProphecy(PROPHET, SLUG, SENTENCE, token);
    }

    function _prophecyDns() internal view returns (bytes memory) {
        return DnsCodec.join(SLUG, DnsCodec.join(PROPHET, parentDns));
    }
}
