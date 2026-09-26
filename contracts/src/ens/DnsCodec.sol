// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// DNS wire encoding and namehash for ENSv2 setters (`bytes name`).
library DnsCodec {
    error InvalidDnsName();

    /// Prepend one label to a DNS-encoded suffix that already ends with `0x00`.
    function join(string memory label, bytes memory rest) internal pure returns (bytes memory out) {
        bytes memory lb = bytes(label);
        if (lb.length == 0 || lb.length > 63) revert InvalidDnsName();
        if (rest.length == 0 || rest[rest.length - 1] != 0) revert InvalidDnsName();
        out = abi.encodePacked(uint8(lb.length), lb, rest);
    }

    function namehash(bytes memory dns) internal pure returns (bytes32 node) {
        if (dns.length == 0 || dns[dns.length - 1] != 0) revert InvalidDnsName();
        node = bytes32(0);
        uint256 i = 0;
        while (i < dns.length) {
            uint256 len = uint8(dns[i]);
            if (len == 0) {
                if (i + 1 != dns.length) revert InvalidDnsName();
                return _namehashFromLabels(dns);
            }
            i += 1 + len;
        }
        revert InvalidDnsName();
    }

    /// namehash is parent-first: walk labels from the TLD up.
    function _namehashFromLabels(bytes memory dns) private pure returns (bytes32 node) {
        uint256 n = _labelCount(dns);
        bytes32[] memory labels = new bytes32[](n);
        uint256 i = 0;
        uint256 idx = 0;
        while (i < dns.length) {
            uint256 len = uint8(dns[i]);
            if (len == 0) break;
            bytes memory lb = new bytes(len);
            for (uint256 j; j < len; ++j) {
                lb[j] = dns[i + 1 + j];
            }
            labels[idx] = keccak256(lb);
            idx++;
            i += 1 + len;
        }
        node = bytes32(0);
        while (idx > 0) {
            idx--;
            node = keccak256(abi.encodePacked(node, labels[idx]));
        }
    }

    function _labelCount(bytes memory dns) private pure returns (uint256 n) {
        uint256 i = 0;
        while (i < dns.length) {
            uint256 len = uint8(dns[i]);
            if (len == 0) return n;
            n++;
            i += 1 + len;
        }
    }
}
