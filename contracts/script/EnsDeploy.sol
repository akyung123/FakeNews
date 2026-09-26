// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DnsCodec} from "../src/ens/DnsCodec.sol";
import {IPermissionedRegistry, IVerifiableFactory} from "../src/ens/EnsV2.sol";
import {ProphecyEns} from "../src/ens/ProphecyEns.sol";
import {SepoliaConfig} from "./SepoliaConfig.sol";

/// Shared ProphecyEns CREATE for Deploy.s.sol and SetupParent.deployAdapter().
/// `new` is inlined into the caller, so CREATE uses the broadcast sender's nonce.
library EnsDeploy {
    /// DNS-encode `<label>.eth` the same way LaunchpadEns.t.sol builds parentDns.
    function parentDns(string memory label) internal pure returns (bytes memory) {
        bytes memory tld = abi.encodePacked(uint8(3), bytes("eth"), bytes1(0));
        return DnsCodec.join(label, tld);
    }

    function deployAdapter(address predictedPad, address parentRegistry, string memory label)
        internal
        returns (ProphecyEns adapter)
    {
        require(predictedPad != address(0), "predicted Launchpad");
        require(parentRegistry != address(0), "set PARENT_USER_REGISTRY");
        adapter = new ProphecyEns(
            predictedPad,
            IPermissionedRegistry(parentRegistry),
            parentDns(label),
            IVerifiableFactory(SepoliaConfig.VERIFIABLE_FACTORY),
            SepoliaConfig.USER_REGISTRY_IMPL,
            SepoliaConfig.PERMISSIONED_RESOLVER_IMPL
        );
    }
}
