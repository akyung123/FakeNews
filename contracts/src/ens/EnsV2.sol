// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Thin ENSv2 types matching contracts-v2 `71a3b73` (DECISIONS #4).
/// Launchpad talks to ProphecyEns; this file is not a second copy of sentence data.

struct Grant {
    address account;
    uint256 roleBitmap;
}

uint256 constant ROOT_RESOURCE = 0;

/// Registry roles (`RegistryRolesLib` at `71a3b73`).
uint256 constant ROLE_REGISTRAR = 1 << 0;
uint256 constant ROLE_SET_PARENT = 1 << 8;
uint256 constant ROLE_SET_PARENT_ADMIN = ROLE_SET_PARENT << 128;
uint256 constant ROLE_UNREGISTER = 1 << 12;
uint256 constant ROLE_SET_SUBREGISTRY = 1 << 20;
uint256 constant ROLE_SET_RESOLVER = 1 << 24;
uint256 constant ROLE_CAN_TRANSFER_ADMIN = (1 << 28) << 128;
uint256 constant ROLE_UPGRADE = 1 << 124;

/// Resolver roles (`PermissionedResolverLib` at `71a3b73`).
uint256 constant ROLE_SET_ADDRESS = 1 << 0;
uint256 constant ROLE_SET_TEXT = 1 << 4;
uint256 constant ROLE_SET_TEXT_ADMIN = ROLE_SET_TEXT << 128;
uint256 constant ROLE_LINK = 1 << 28;
uint256 constant ROLE_LINK_ADMIN = ROLE_LINK << 128;
uint256 constant ROLE_RESOLVER_UPGRADE = 1 << 124;
uint256 constant ROLE_RESOLVER_UPGRADE_ADMIN = ROLE_RESOLVER_UPGRADE << 128;

uint256 constant COIN_TYPE_ETH = 60;

interface IRegistry {
    function getSubregistry(string calldata label) external view returns (IRegistry);
    function getResolver(string calldata label) external view returns (address);
}

interface IPermissionedRegistry is IRegistry {
    error TransferDisallowed(uint256 tokenId, address from);
    error LabelAlreadyRegistered(string label);
    error CannotSetPastExpiry(uint64 expiry);
    error EACUnauthorizedAccountRoles(uint256 resource, uint256 roleBitmap, address account);

    struct State {
        uint8 status;
        uint64 expiry;
        address latestOwner;
        uint256 tokenId;
        uint256 resource;
    }

    function register(
        string calldata label,
        address owner,
        IRegistry registry,
        address resolver,
        uint256 roleBitmap,
        uint64 expiry
    ) external returns (uint256 tokenId);

    function setParent(IRegistry parent, string calldata label) external;
    function setResolver(uint256 anyId, address resolver) external;
    function setSubregistry(uint256 anyId, IRegistry registry) external;
    function unregister(uint256 anyId) external;
    function revokeRootRoles(uint256 roleBitmap, address account) external returns (bool);
    function grantRootRoles(uint256 roleBitmap, address account) external returns (bool);

    function findOwner(string calldata label) external view returns (address);
    function getState(uint256 anyId) external view returns (State memory);
    function getTokenId(uint256 anyId) external view returns (uint256);
    function hasAssignees(uint256 resource, uint256 roleBitmap) external view returns (bool);
    function isEmancipated() external view returns (bool);
    function ROOT_RESOURCE() external view returns (uint256);

    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data)
        external;
}

interface IPermissionedResolver {
    error EACUnauthorizedAccountRoles(uint256 resource, uint256 roleBitmap, address account);

    function initialize(Grant[] calldata grants, bytes[] calldata calls) external;
    function setText(bytes calldata name, string calldata key, string calldata value) external;
    function setAddress(bytes calldata name, uint256 coinType, bytes calldata addressBytes) external;
    function grantSetterRoles(bytes calldata setter, address account) external returns (bool);
    function revokeRootRoles(uint256 roleBitmap, address account) external returns (bool);
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory);
    function hasAssignees(uint256 resource, uint256 roleBitmap) external view returns (bool);
    function hasRoles(uint256 resource, uint256 roleBitmap, address account) external view returns (bool);
}

interface IUserRegistryInit {
    function initialize(Grant[] calldata grants) external;
}

interface IVerifiableFactory {
    function deployProxy(address implementation, uint256 salt, bytes memory data)
        external
        returns (address proxy);
}
