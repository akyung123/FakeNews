// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DnsCodec} from "./DnsCodec.sol";
import {IProphecyEns} from "./IProphecyEns.sol";
import {
    COIN_TYPE_ETH,
    Grant,
    IPermissionedRegistry,
    IPermissionedResolver,
    IRegistry,
    IUserRegistryInit,
    IVerifiableFactory,
    ROLE_REGISTRAR,
    ROLE_SET_PARENT,
    ROLE_SET_PARENT_ADMIN,
    ROLE_SET_TEXT_ADMIN
} from "./EnsV2.sol";

/// ENSv2 adapter. Separate from Launchpad so name lock lives in one place.
/// `name.parent` → prophet wallet; `slug.name.parent` → token.
/// Sentence and deadline are written once in the prophecy resolver's initialize calls.
contract ProphecyEns is IProphecyEns {
    error NotLaunchpad();
    error ZeroAddress();
    error InvalidLabel();
    error InvalidSlug();
    error InvalidProphecy();
    error UnknownProphet();

    address public immutable launchpad;
    IPermissionedRegistry public immutable parentRegistry;
    IVerifiableFactory public immutable factory;
    address public immutable userRegistryImpl;
    address public immutable resolverImpl;
    bytes public parentDnsName;

    modifier onlyLaunchpad() {
        if (msg.sender != launchpad) revert NotLaunchpad();
        _;
    }

    constructor(
        address launchpad_,
        IPermissionedRegistry parentRegistry_,
        bytes memory parentDnsName_,
        IVerifiableFactory factory_,
        address userRegistryImpl_,
        address resolverImpl_
    ) {
        if (
            launchpad_ == address(0) || address(parentRegistry_) == address(0)
                || address(factory_) == address(0) || userRegistryImpl_ == address(0)
                || resolverImpl_ == address(0)
        ) {
            revert ZeroAddress();
        }
        if (parentDnsName_.length == 0 || parentDnsName_[parentDnsName_.length - 1] != 0) {
            revert InvalidLabel();
        }
        launchpad = launchpad_;
        parentRegistry = parentRegistry_;
        parentDnsName = parentDnsName_;
        factory = factory_;
        userRegistryImpl = userRegistryImpl_;
        resolverImpl = resolverImpl_;
    }

    /// @inheritdoc IProphecyEns
    function registerProphet(string calldata label, address wallet)
        external
        onlyLaunchpad
        returns (address registry, address resolver)
    {
        if (wallet == address(0)) revert ZeroAddress();
        if (!_isProphetLabel(label)) revert InvalidLabel();

        bytes memory prophetDns = DnsCodec.join(label, parentDnsName);

        Grant[] memory registryGrants = new Grant[](1);
        registryGrants[0] = Grant({
            account: address(this),
            roleBitmap: ROLE_REGISTRAR | ROLE_SET_PARENT | ROLE_SET_PARENT_ADMIN
        });
        registry = factory.deployProxy(
            userRegistryImpl,
            _registrySalt(prophetDns),
            abi.encodeCall(IUserRegistryInit.initialize, (registryGrants))
        );

        IPermissionedRegistry prophetRegistry = IPermissionedRegistry(registry);
        prophetRegistry.setParent(parentRegistry, label);
        prophetRegistry.revokeRootRoles(ROLE_SET_PARENT | ROLE_SET_PARENT_ADMIN, address(this));

        resolver = _deployLockedResolver(
            wallet, prophetDns, _addressCall(prophetDns, wallet), _resolverSalt(wallet, prophetDns)
        );

        parentRegistry.register(
            label, wallet, IRegistry(registry), resolver, 0, type(uint64).max
        );

        emit ProphetNameCreated(wallet, label, registry, resolver);
    }

    /// @inheritdoc IProphecyEns
    function registerProphecy(
        string calldata prophetLabel,
        string calldata slug,
        string calldata prophecy,
        uint64 deadline,
        address token
    ) external onlyLaunchpad returns (address resolver) {
        if (token == address(0)) revert ZeroAddress();
        if (!_isProphetLabel(prophetLabel)) revert InvalidLabel();
        if (!_isSlug(slug)) revert InvalidSlug();
        if (!_isProphecy(prophecy)) revert InvalidProphecy();

        address registry = address(parentRegistry.getSubregistry(prophetLabel));
        address wallet = parentRegistry.findOwner(prophetLabel);
        if (registry == address(0) || wallet == address(0)) revert UnknownProphet();

        bytes memory prophecyDns = DnsCodec.join(slug, DnsCodec.join(prophetLabel, parentDnsName));

        bytes[] memory calls = new bytes[](3);
        calls[0] = abi.encodeCall(IPermissionedResolver.setText, (prophecyDns, "prophecy", prophecy));
        calls[1] = abi.encodeCall(
            IPermissionedResolver.setText, (prophecyDns, "deadline", DnsCodec.toDecimal(deadline))
        );
        calls[2] = _addressCall(prophecyDns, token);

        resolver =
            _deployLockedResolver(wallet, prophecyDns, calls, _resolverSalt(token, prophecyDns));

        IPermissionedRegistry(registry).register(
            slug, wallet, IRegistry(address(0)), resolver, 0, type(uint64).max
        );

        emit ProphecyNameCreated(token, prophetLabel, slug, resolver);
    }

    function _deployLockedResolver(
        address prophet,
        bytes memory, /* dns — salt/calls already bound */
        bytes[] memory recordCalls,
        uint256 salt
    ) internal returns (address resolver) {
        Grant[] memory grants = new Grant[](1);
        grants[0] = Grant({account: address(this), roleBitmap: ROLE_SET_TEXT_ADMIN});
        resolver = factory.deployProxy(
            resolverImpl,
            salt,
            abi.encodeCall(IPermissionedResolver.initialize, (grants, recordCalls))
        );

        IPermissionedResolver r = IPermissionedResolver(resolver);
        r.grantSetterRoles(_textSetter("avatar"), prophet);
        r.grantSetterRoles(_textSetter("description"), prophet);
        r.revokeRootRoles(ROLE_SET_TEXT_ADMIN, address(this));
    }

    function _deployLockedResolver(
        address prophet,
        bytes memory dns,
        bytes memory singleCall,
        uint256 salt
    ) internal returns (address resolver) {
        bytes[] memory calls = new bytes[](1);
        calls[0] = singleCall;
        resolver = _deployLockedResolver(prophet, dns, calls, salt);
    }

    function _addressCall(bytes memory dns, address account) internal pure returns (bytes memory) {
        return abi.encodeCall(
            IPermissionedResolver.setAddress, (dns, COIN_TYPE_ETH, abi.encodePacked(account))
        );
    }

    function _textSetter(string memory key) internal pure returns (bytes memory) {
        return abi.encodeCall(IPermissionedResolver.setText, (hex"", key, ""));
    }

    function _registrySalt(bytes memory dns) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked("UserRegistry", keccak256(dns), uint256(1))));
    }

    function _resolverSalt(address owner, bytes memory dns) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked("OwnedResolver", owner, keccak256(dns), uint256(1))));
    }

    function _isProphetLabel(string memory s) internal pure returns (bool) {
        bytes memory b = bytes(s);
        if (b.length < 3 || b.length > 16) return false;
        for (uint256 i; i < b.length; ++i) {
            if (!_isAlnum(b[i])) return false;
        }
        return true;
    }

    function _isSlug(string memory s) internal pure returns (bool) {
        bytes memory b = bytes(s);
        if (b.length < 3 || b.length > 32) return false;
        if (b[0] == "-" || b[b.length - 1] == "-") return false;
        for (uint256 i; i < b.length; ++i) {
            bytes1 c = b[i];
            if (!_isAlnum(c) && c != "-") return false;
        }
        return true;
    }

    function _isProphecy(string memory s) internal pure returns (bool) {
        uint256 n = bytes(s).length;
        return n >= 1 && n <= 140;
    }

    function _isAlnum(bytes1 c) internal pure returns (bool) {
        return (c >= 0x30 && c <= 0x39) || (c >= 0x61 && c <= 0x7a);
    }
}
