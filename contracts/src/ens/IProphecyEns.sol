// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Functions Launchpad calls after World ID / mint. The sentence is written
/// only into the prophecy resolver — never stored here.
interface IProphecyEns {
    event ProphetNameCreated(
        address indexed wallet, string label, address registry, address resolver
    );
    event ProphecyNameCreated(
        address indexed token, string prophetLabel, string slug, address resolver
    );

    /// Create `label.parent` → `wallet`. Deploys that prophet's registry and resolver.
    function registerProphet(string calldata label, address wallet)
        external
        returns (address registry, address resolver);

    /// Create `slug.label.parent` → `token`. Writes `prophecy` and the address
    /// record once during resolver `initialize`.
    function registerProphecy(
        string calldata prophetLabel,
        string calldata slug,
        string calldata prophecy,
        address token
    ) external returns (address resolver);
}
