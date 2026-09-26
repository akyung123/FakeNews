// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Official Sepolia addresses the deploy scripts read.
/// ENS values are from docs/ENSV2.md section 0 (contracts-v2 `71a3b73`).
/// Uniswap v4 / LBP / CCA values are the official Sepolia deployments.
/// Override PoolManager with UNISWAP_V4_POOL_MANAGER, LBP with LBP_STRATEGY,
/// PositionManager with POSITION_MANAGER.
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
    address internal constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;

    // Uniswap v4 PositionManager on Sepolia. Launchpad.setCca writes this
    // into LiquidityLocker via locker.setPositionManager.
    address internal constant POSITION_MANAGER = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;

    // Official LBPStrategy v3.3.0 on Sepolia. ProphecyHook.authorized and
    // Launchpad.setCca both take this address — not the Launchpad.
    address internal constant LBP_STRATEGY = 0x95434E898Af471945Cab33D5064d2aC1A6Ba2000;

    // Official CCA factory v2.1.0 on Sepolia. Launchpad reads it at launch
    // via lbpStrategy.initializerFactory(); the deploy script only records it.
    address internal constant CCA_FACTORY = 0x000000001F26a0044BaA66024e7b6599c61963F8;

    // Official InitializerHook on Sepolia. We deploy our own ProphecyHook
    // (same authorized() pattern). Recorded for the address book.
    address internal constant INITIALIZER_HOOK = 0x1600059B95A80d500fC42400ea9a88A9C29D2000;

    // Uniswap Universal Router (v4) on Sepolia. Not a Launchpad constructor arg.
    address internal constant UNIVERSAL_ROUTER = 0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3;

    // Canonical Permit2. Not a Launchpad constructor arg.
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
}
