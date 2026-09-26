// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ProphecyEns} from "../src/ens/ProphecyEns.sol";
import {EnsDeploy} from "./EnsDeploy.sol";
import {SepoliaConfig} from "./SepoliaConfig.sol";
import {ScriptVm} from "./ScriptVm.sol";

/// Surfaces that already exist on Sepolia (ENSV2 `71a3b73`).
interface IVerifiableFactory {
    function deployProxy(address implementation, uint256 salt, bytes calldata data) external returns (address);
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
///   deployUserRegistry → Deploy.s.sol (adapter then Launchpad, one broadcast)
///   → linkParent → grantAdapterRegistrar.
/// Do not lock the parent name here (irreversible; later lock PR).
///
///   ./script/run-sepolia.sh script/SetupParent.s.sol --sig "deployUserRegistry()"
///   ./script/run-sepolia.sh script/Deploy.s.sol
///   ./script/run-sepolia.sh script/SetupParent.s.sol --sig "linkParent()"
///   ./script/run-sepolia.sh script/SetupParent.s.sol --sig "grantAdapterRegistrar()"
///
/// Role bits from docs/ENSV2.md section 3. Do not grant UNREGISTER or SET_SUBREGISTRY.
contract SetupParent is ScriptVm {
    uint256 internal constant ROLE_REGISTRAR = 1 << 0;
    uint256 internal constant ROLE_SET_PARENT = 1 << 8;
    uint256 internal constant ROLE_RENEW = 1 << 16;
    uint256 internal constant ADMIN = 1 << 128;

    event ParentRegistry(address registry);
    event Linked(string label, address registry);
    event RegistrarGranted(address adapter);
    event AdapterDeployed(address adapter, address predictedLaunchpad);

    function deployUserRegistry() external {
        require(_sepolia(), "sepolia or anvil only");
        address owner = _teamWallet();
        uint256 salt = uint256(vm.envOr("USER_REGISTRY_SALT", keccak256("UserRegistry")));
        uint256 initRoles = (ROLE_REGISTRAR | ROLE_RENEW | ROLE_SET_PARENT) * (1 + ADMIN);

        Grant[] memory grants = new Grant[](1);
        grants[0] = Grant({account: owner, roleBitmap: initRoles});
        bytes memory init = abi.encodeCall(IUserRegistry.initialize, (grants));

        _start();
        address registry = IVerifiableFactory(SepoliaConfig.VERIFIABLE_FACTORY)
            .deployProxy(SepoliaConfig.USER_REGISTRY_IMPL, salt, init);
        vm.stopBroadcast();

        emit ParentRegistry(registry);
        _pasteLine(string.concat("PARENT_USER_REGISTRY=", vm.toString(registry)));
    }

    /// Standalone adapter CREATE with predicted Launchpad at nonce+1.
    /// Preferred path is Deploy.s.sol (adapter + Launchpad in one broadcast).
    /// If you use this, the next CREATE from the same wallet must be Launchpad
    /// (`Deploy.s.sol` with ENS_ADAPTER_ADDRESS set).
    function deployAdapter() external {
        require(_sepolia(), "sepolia or anvil only");
        address parentRegistry = vm.envAddress("PARENT_USER_REGISTRY");
        string memory label = vm.envOr("PARENT_LABEL", string("prophecy"));
        address deployer = _deployer();
        _teamWallet();

        _start();
        uint64 n = vm.getNonce(deployer);
        address predictedPad = vm.computeCreateAddress(deployer, uint256(n) + 1);
        ProphecyEns adapter = EnsDeploy.deployAdapter(predictedPad, parentRegistry, label);
        vm.stopBroadcast();

        emit AdapterDeployed(address(adapter), predictedPad);
        _pasteLine(string.concat("ENS_ADAPTER_ADDRESS=", vm.toString(address(adapter))));
        _pasteLine(string.concat("PREDICTED_LAUNCHPAD=", vm.toString(predictedPad)));
    }

    function linkParent() external {
        require(_sepolia(), "sepolia or anvil only");
        string memory label = vm.envOr("PARENT_LABEL", string("prophecy"));
        address registry = vm.envAddress("PARENT_USER_REGISTRY");
        uint256 labelhash = uint256(keccak256(bytes(label)));
        address team = _teamWallet();

        _start();
        IETHRegistry(SepoliaConfig.ETH_REGISTRY).setSubregistry(labelhash, registry);
        IUserRegistry(registry).setParent(SepoliaConfig.ETH_REGISTRY, label);
        IUserRegistry(registry).revokeRootRoles(ROLE_SET_PARENT * (1 + ADMIN), team);
        vm.stopBroadcast();

        emit Linked(label, registry);
        // TODO(lock PR): do not revoke SET_SUBREGISTRY on .eth for this label here.
        // That emancipation is irreversible and needs a person to confirm.
    }

    /// ROLE_REGISTRAR on the parent UserRegistry goes to ProphecyEns (the
    /// msg.sender of parentRegistry.register), not to Launchpad.
    function grantAdapterRegistrar() external {
        require(_sepolia(), "sepolia or anvil only");
        address registry = vm.envAddress("PARENT_USER_REGISTRY");
        address adapter = vm.envAddress("ENS_ADAPTER_ADDRESS");
        require(adapter != address(0), "set ENS_ADAPTER_ADDRESS");
        require(adapter != address(uint160(0xe05)), "ENS_ADAPTER_ADDRESS cannot be placeholder 0xe05");

        _start();
        IUserRegistry(registry).grantRootRoles(ROLE_REGISTRAR, adapter);
        vm.stopBroadcast();

        emit RegistrarGranted(adapter);
        _pasteLine(string.concat("ADAPTER_REGISTRAR=", vm.toString(adapter)));
    }

    function grantLaunchpadRegistrar() external pure {
        revert("use grantAdapterRegistrar (ROLE_REGISTRAR goes to ProphecyEns)");
    }

    function _sepolia() internal view returns (bool) {
        return block.chainid == SepoliaConfig.CHAIN_ID || block.chainid == 31337;
    }
}
