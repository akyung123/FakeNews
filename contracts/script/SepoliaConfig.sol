// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Official Sepolia addresses the deploy scripts read.
/// ENS values are from docs/ENSV2.md section 0 (contracts-v2 `71a3b73`).
/// PoolManager is the Uniswap v4 Sepolia deployment; override with UNISWAP_V4_POOL_MANAGER.
library SepoliaConfig {
    uint256 internal constant CHAIN_ID = 11155111;

    address internal constant ROOT_REGISTRY = 0x9703DBD26dAB89504490994138cF2c575251a9cE;
    address internal constant ETH_REGISTRY = 0x657eA849311d3D5823348ddEd7C2AaAFb3EDE09E;
    address internal constant ETH_REGISTRAR = 0xAbe76F6C8DFcEd81AA5A2bB8034202A7136b94ca;
    address internal constant VERIFIABLE_FACTORY = 0x9e726Eb570beb6BCEb495AB8cdA7df517d4e841C;
    address internal constant USER_REGISTRY_IMPL = 0xA80338aAA8D23831cEa25E858D1774534aBb0263;
    address internal constant PERMISSIONED_RESOLVER_IMPL = 0x14F09Fd05d4585759e54844DC9B00147131Cf243;
    address internal constant UNIVERSAL_RESOLVER_V2 = 0x5d25C1D6aCBb71B7a28AA7899618a3412a8303e3;
    address internal constant MOCK_USDC = 0x16f95D91DBa7dA3Aca778Ec053dF0FF6C6A8aA8e;

    // Uniswap v4 PoolManager on Sepolia — official deployments table
    // https://docs.uniswap.org/contracts/v4/deployments (Sepolia / PoolManager).
    // Same address as v4-periphery `SepoliaConfig.POOL_MANAGER`.
    address internal constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
}
