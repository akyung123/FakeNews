// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DnsCodec} from "../src/ens/DnsCodec.sol";
import {
    Grant,
    IRegistry,
    ROLE_CAN_TRANSFER_ADMIN,
    ROLE_REGISTRAR,
    ROLE_SET_ADDRESS,
    ROLE_SET_PARENT,
    ROLE_SET_RESOLVER,
    ROLE_SET_SUBREGISTRY,
    ROLE_SET_TEXT,
    ROLE_SET_TEXT_ADMIN,
    ROLE_UNREGISTER,
    ROLE_UPGRADE,
    ROOT_RESOURCE
} from "../src/ens/EnsV2.sol";

/// Shared EAC bitmap used by the lock harness. Role bits match `71a3b73`.
contract LockEac {
    error EACUnauthorizedAccountRoles(uint256 resource, uint256 roleBitmap, address account);

    mapping(uint256 => mapping(address => uint256)) internal _roles;
    mapping(uint256 => mapping(uint256 => uint256)) internal _counts;

    function hasAssignees(uint256 resource, uint256 roleBitmap) public view returns (bool) {
        for (uint256 i; i < 256; i += 4) {
            uint256 bit = uint256(1) << i;
            if (roleBitmap & bit != 0 && _counts[resource][bit] > 0) return true;
        }
        return false;
    }

    function hasRoles(uint256 resource, uint256 roleBitmap, address account) public view returns (bool) {
        return _has(resource, roleBitmap, account);
    }

    function getRootResource() external pure returns (uint256) {
        return 0;
    }

    function grantRootRoles(uint256 roleBitmap, address account) external returns (bool) {
        _grant(ROOT_RESOURCE, account, roleBitmap);
        return true;
    }

    function revokeRootRoles(uint256 roleBitmap, address account) external returns (bool) {
        _revoke(ROOT_RESOURCE, account, roleBitmap);
        return true;
    }

    function _has(uint256 resource, uint256 roleBitmap, address account) internal view returns (bool) {
        return (_roles[resource][account] & roleBitmap) == roleBitmap
            || (_roles[ROOT_RESOURCE][account] & roleBitmap) == roleBitmap;
    }

    function _grant(uint256 resource, address account, uint256 bitmap) internal {
        uint256 old = _roles[resource][account];
        uint256 added = bitmap & ~old;
        _roles[resource][account] = old | bitmap;
        _bump(resource, added, true);
    }

    function _revoke(uint256 resource, address account, uint256 bitmap) internal {
        uint256 old = _roles[resource][account];
        uint256 removed = bitmap & old;
        _roles[resource][account] = old & ~bitmap;
        _bump(resource, removed, false);
    }

    function _bump(uint256 resource, uint256 bitmap, bool add) private {
        for (uint256 i; i < 256; i += 4) {
            uint256 bit = uint256(1) << i;
            if (bitmap & bit == 0) continue;
            if (add) _counts[resource][bit] += 1;
            else _counts[resource][bit] -= 1;
        }
    }

    function _requireRole(uint256 resource, uint256 roleBitmap, address account) internal view {
        if (!_has(resource, roleBitmap, account)) {
            revert EACUnauthorizedAccountRoles(resource, roleBitmap, account);
        }
    }
}

/// UserRegistry / PermissionedRegistry stand-in for lock tests.
contract LockRegistry is LockEac {
    error TransferDisallowed(uint256 tokenId, address from);
    error LabelAlreadyRegistered(string label);
    error CannotSetPastExpiry(uint64 expiry);

    struct State {
        uint8 status;
        uint64 expiry;
        address latestOwner;
        uint256 tokenId;
        uint256 resource;
    }

    mapping(uint256 => address) public ownerOf;
    mapping(uint256 => address) public resolverOf;
    mapping(uint256 => address) public subregistryOf;
    mapping(uint256 => uint64) public expiryOf;
    mapping(uint256 => uint256) public ownerRoles;

    IRegistry public parent;
    string public childLabel;

    function initialize(Grant[] calldata grants) external {
        for (uint256 i; i < grants.length; ++i) {
            _grant(ROOT_RESOURCE, grants[i].account, grants[i].roleBitmap);
        }
    }

    function register(
        string calldata label,
        address owner,
        IRegistry registry,
        address resolver,
        uint256 roleBitmap,
        uint64 expiry
    ) external returns (uint256 tokenId) {
        _requireRole(ROOT_RESOURCE, ROLE_REGISTRAR, msg.sender);
        if (expiry == 0 || expiry < block.timestamp) revert CannotSetPastExpiry(expiry);
        tokenId = uint256(keccak256(bytes(label)));
        if (ownerOf[tokenId] != address(0) && expiryOf[tokenId] > block.timestamp) {
            revert LabelAlreadyRegistered(label);
        }
        ownerOf[tokenId] = owner;
        resolverOf[tokenId] = resolver;
        subregistryOf[tokenId] = address(registry);
        expiryOf[tokenId] = expiry;
        ownerRoles[tokenId] = roleBitmap;
        if (roleBitmap != 0) _grant(tokenId, owner, roleBitmap);
    }

    function setParent(IRegistry parent_, string calldata label) external {
        _requireRole(ROOT_RESOURCE, ROLE_SET_PARENT, msg.sender);
        parent = parent_;
        childLabel = label;
    }

    function setResolver(uint256 anyId, address resolver) external {
        _requireRole(anyId, ROLE_SET_RESOLVER, msg.sender);
        resolverOf[anyId] = resolver;
    }

    function setSubregistry(uint256 anyId, IRegistry registry) external {
        _requireRole(anyId, ROLE_SET_SUBREGISTRY, msg.sender);
        subregistryOf[anyId] = address(registry);
    }

    function unregister(uint256 anyId) external {
        _requireRole(anyId, ROLE_UNREGISTER, msg.sender);
        ownerOf[anyId] = address(0);
        resolverOf[anyId] = address(0);
        subregistryOf[anyId] = address(0);
        expiryOf[anyId] = uint64(block.timestamp);
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256, bytes calldata) external {
        require(msg.sender == from, "not owner");
        require(ownerOf[id] == from, "token");
        if ((ownerRoles[id] & ROLE_CAN_TRANSFER_ADMIN) == 0) {
            revert TransferDisallowed(id, from);
        }
        ownerOf[id] = to;
    }

    function findOwner(string calldata label) external view returns (address) {
        return ownerOf[uint256(keccak256(bytes(label)))];
    }

    function getSubregistry(string calldata label) external view returns (IRegistry) {
        return IRegistry(subregistryOf[uint256(keccak256(bytes(label)))]);
    }

    function getResolver(string calldata label) external view returns (address) {
        return resolverOf[uint256(keccak256(bytes(label)))];
    }

    function getState(uint256 anyId) external view returns (State memory s) {
        s.tokenId = anyId;
        s.resource = anyId;
        s.latestOwner = ownerOf[anyId];
        s.expiry = expiryOf[anyId];
        s.status = ownerOf[anyId] == address(0) ? 0 : 2;
    }

    function getTokenId(uint256 anyId) external pure returns (uint256) {
        return anyId;
    }

    function isEmancipated() external view returns (bool) {
        uint256 dangerous = ROLE_SET_SUBREGISTRY | (ROLE_SET_SUBREGISTRY << 128) | ROLE_SET_RESOLVER
            | (ROLE_SET_RESOLVER << 128) | ROLE_UNREGISTER | (ROLE_UNREGISTER << 128) | ROLE_UPGRADE
            | (ROLE_UPGRADE << 128);
        return !hasAssignees(ROOT_RESOURCE, dangerous);
    }
}

/// PermissionedResolver stand-in. `initialize` writes records with role checks skipped.
contract LockResolver is LockEac {
    bool internal _initializing;
    uint256 internal _recordCount;
    mapping(bytes32 => uint256) internal _recordIds;
    mapping(uint256 => mapping(string => string)) internal _texts;
    mapping(uint256 => mapping(uint256 => bytes)) internal _addrs;

    function initialize(Grant[] calldata grants, bytes[] calldata calls) external {
        for (uint256 i; i < grants.length; ++i) {
            _grant(ROOT_RESOURCE, grants[i].account, grants[i].roleBitmap);
        }
        _initializing = true;
        for (uint256 i; i < calls.length; ++i) {
            (bool ok, bytes memory err) = address(this).call(calls[i]);
            if (!ok) {
                assembly {
                    revert(add(err, 0x20), mload(err))
                }
            }
        }
        _initializing = false;
    }

    function setText(bytes calldata name, string calldata key, string calldata value) external {
        if (!_initializing) {
            _requireRole(uint256(keccak256(bytes(key))), ROLE_SET_TEXT, msg.sender);
        }
        _texts[_ensure(name)][key] = value;
    }

    function setAddress(bytes calldata name, uint256 coinType, bytes calldata addressBytes) external {
        if (!_initializing) {
            _requireRole(uint256(keccak256(abi.encodePacked(coinType))), ROLE_SET_ADDRESS, msg.sender);
        }
        _addrs[_ensure(name)][coinType] = addressBytes;
    }

    function grantSetterRoles(bytes calldata setter, address account) external returns (bool) {
        _requireRole(ROOT_RESOURCE, ROLE_SET_TEXT_ADMIN, msg.sender);
        (, string memory key,) = abi.decode(setter[4:], (bytes, string, string));
        _grant(uint256(keccak256(bytes(key))), account, ROLE_SET_TEXT);
        return true;
    }

    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory) {
        uint256 id = _recordIds[DnsCodec.namehash(name)];
        bytes4 sel = bytes4(data);
        if (sel == bytes4(keccak256("text(bytes32,string)"))) {
            (, string memory key) = abi.decode(data[4:], (bytes32, string));
            return abi.encode(_texts[id][key]);
        }
        if (sel == bytes4(keccak256("addr(bytes32)"))) {
            return abi.encode(_asAddress(_addrs[id][60]));
        }
        if (sel == bytes4(keccak256("addr(bytes32,uint256)"))) {
            (, uint256 coinType) = abi.decode(data[4:], (bytes32, uint256));
            return abi.encode(_addrs[id][coinType]);
        }
        revert("unsupported profile");
    }

    function _ensure(bytes memory name) internal returns (uint256 id) {
        bytes32 node = DnsCodec.namehash(name);
        id = _recordIds[node];
        if (id == 0) {
            id = ++_recordCount;
            _recordIds[node] = id;
        }
    }

    function _asAddress(bytes memory raw) internal pure returns (address a) {
        if (raw.length == 20) {
            a = address(uint160(bytes20(raw)));
        }
    }
}

/// VerifiableFactory stand-in: deploys a fresh harness instance and runs init data.
contract LockFactory {
    address public immutable registryKind;
    address public immutable resolverKind;

    constructor(address registryKind_, address resolverKind_) {
        registryKind = registryKind_;
        resolverKind = resolverKind_;
    }

    function deployProxy(address implementation, uint256, bytes memory data)
        external
        returns (address proxy)
    {
        if (implementation == registryKind) {
            proxy = address(new LockRegistry());
        } else {
            require(implementation == resolverKind, "impl");
            proxy = address(new LockResolver());
        }
        (bool ok, bytes memory err) = proxy.call(data);
        if (!ok) {
            assembly {
                revert(add(err, 0x20), mload(err))
            }
        }
    }
}

/// Prophet-controlled caller so lock tests do not need `vm.prank`.
contract LockActor {
    function transferName(address registry, uint256 tokenId, address to) external {
        LockRegistry(registry).safeTransferFrom(address(this), to, tokenId, 1, "");
    }

    function setText(address resolver, bytes calldata name, string calldata key, string calldata value)
        external
    {
        LockResolver(resolver).setText(name, key, value);
    }

    function setResolver(address registry, uint256 anyId, address resolver) external {
        LockRegistry(registry).setResolver(anyId, resolver);
    }

    function setSubregistry(address registry, uint256 anyId, address next) external {
        LockRegistry(registry).setSubregistry(anyId, IRegistry(next));
    }
}
