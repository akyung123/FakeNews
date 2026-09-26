// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SepoliaConfig} from "./SepoliaConfig.sol";
import {ScriptVm} from "./ScriptVm.sol";

/// Surfaces that already exist on Sepolia (ENSV2 `71a3b73`). Our Launchpad is still landing.
interface IVerifiableFactory {
    function deployProxy(address implementation, bytes32 salt, bytes calldata data) external returns (address);
}

struct Grant {
    address account;
    uint256 roleBitmap;
}

interface IUserRegistry {
    function initialize(Grant[] calldata grants) external;
    function setParent(address parent, string calldata label) external;
    function grantRootRoles(uint256 roleBitmap, address account) external;
    function revokeRootRoles(uint256 roleBitmap, address account) external;
}

interface IETHRegistry {
    function setSubregistry(uint256 anyId, address registry) external;
}

/// After prophecy.eth is registered, order is:
///   deploy UserRegistry → deploy Launchpad (#8) → deploy adapter (#17)
///   → setSubregistry/setParent → grant ROLE_REGISTRAR.
///
///   ./script/run-sepolia.sh script/SetupParent.s.sol --sig "deployUserRegistry()"
///   ./script/run-sepolia.sh script/Deploy.s.sol
///   ./script/run-sepolia.sh script/SetupParent.s.sol --sig "deployAdapter()"
///   ./script/run-sepolia.sh script/SetupParent.s.sol --sig "linkParent()"
///   ./script/run-sepolia.sh script/SetupParent.s.sol --sig "grantLaunchpadRegistrar()"
///
/// Role bits from docs/ENSV2.md section 3. Do not grant UNREGISTER or SET_SUBREGISTRY.
contract SetupParent is ScriptVm {
    uint256 internal constant ROLE_REGISTRAR = 1 << 0;
    uint256 internal constant ROLE_SET_PARENT = 1 << 8;
    uint256 internal constant ROLE_RENEW = 1 << 16;
    uint256 internal constant ADMIN = 1 << 128;

    event ParentRegistry(address registry);
    event Linked(string label, address registry);
    event RegistrarGranted(address launchpad);
    event AdapterPlan(
        address launchpad,
        address parentRegistry,
        string parentDnsName,
        address factory,
        address userRegistryImpl,
        address resolverImpl
    );

    function deployUserRegistry() external {
        require(_sepolia(), "sepolia or anvil only");
        address owner = vm.envAddress("TEAM_WALLET");
        bytes32 salt = vm.envOr("USER_REGISTRY_SALT", keccak256("UserRegistry"));
        uint256 initRoles = (ROLE_REGISTRAR | ROLE_RENEW | ROLE_SET_PARENT) * (1 + ADMIN);

        Grant[] memory grants = new Grant[](1);
        grants[0] = Grant({account: owner, roleBitmap: initRoles});
        bytes memory init = abi.encodeCall(IUserRegistry.initialize, (grants));

        _start();
        address registry = IVerifiableFactory(SepoliaConfig.VERIFIABLE_FACTORY).deployProxy(
            SepoliaConfig.USER_REGISTRY_IMPL, salt, init
        );
        vm.stopBroadcast();

        emit ParentRegistry(registry);
    }

    /// TODO(#17): `new ProphecyEns(launchpad, parentRegistry, parentDnsName, factory, userRegistryImpl, resolverImpl)`.
    /// Exact wiring waits for #17 and #8 to merge. Dry-run emits the planned args.
    function deployAdapter() external {
        require(_sepolia(), "sepolia or anvil only");
        address launchpad = vm.envOr("LAUNCHPAD_ADDRESS", address(0));
        address parentRegistry = vm.envOr("PARENT_USER_REGISTRY", address(0));
        string memory label = vm.envOr("PARENT_LABEL", string("prophecy"));
        string memory parentDnsName = string.concat(label, ".eth");

        emit AdapterPlan(
            launchpad,
            parentRegistry,
            parentDnsName,
            SepoliaConfig.VERIFIABLE_FACTORY,
            SepoliaConfig.USER_REGISTRY_IMPL,
            SepoliaConfig.PERMISSIONED_RESOLVER_IMPL
        );

        if (vm.envExists("DEPLOYER_PRIVATE_KEY")) {
            require(launchpad != address(0), "set LAUNCHPAD_ADDRESS after Launchpad deploy");
            require(parentRegistry != address(0), "set PARENT_USER_REGISTRY");
            revert("TODO(#17): wire ProphecyEns constructor after merge");
        }
    }

    function linkParent() external {
        require(_sepolia(), "sepolia or anvil only");
        string memory label = vm.envOr("PARENT_LABEL", string("prophecy"));
        address registry = vm.envAddress("PARENT_USER_REGISTRY");
        uint256 labelhash = uint256(keccak256(bytes(label)));

        _start();
        IETHRegistry(SepoliaConfig.ETH_REGISTRY).setSubregistry(labelhash, registry);
        IUserRegistry(registry).setParent(SepoliaConfig.ETH_REGISTRY, label);
        IUserRegistry(registry).revokeRootRoles(ROLE_SET_PARENT * (1 + ADMIN), vm.envAddress("TEAM_WALLET"));
        vm.stopBroadcast();

        emit Linked(label, registry);
    }

    function grantLaunchpadRegistrar() external {
        require(_sepolia(), "sepolia or anvil only");
        address registry = vm.envAddress("PARENT_USER_REGISTRY");
        address launchpad = vm.envAddress("LAUNCHPAD_ADDRESS");
        require(launchpad != address(0), "set LAUNCHPAD_ADDRESS when Launchpad lands");

        _start();
        IUserRegistry(registry).grantRootRoles(ROLE_REGISTRAR, launchpad);
        vm.stopBroadcast();

        emit RegistrarGranted(launchpad);
    }

    function _sepolia() internal view returns (bool) {
        return block.chainid == SepoliaConfig.CHAIN_ID || block.chainid == 31337;
    }
}
