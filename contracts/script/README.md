# Contract deploy scripts (Sepolia)

Agents dry-run. A person broadcasts. Never put a private key on argv.

CCA path (this branch, depends on backend PR #42 / `Launchpad.sol` at `b71c64e`):

1. `ProphecyEns` then `Launchpad` in one broadcast (predicted CREATE).
2. CREATE2 `ProphecyHook` — `authorized` is official LBPStrategy v3.3.0, **not** the Launchpad. Salt is mined so the address low bits are `Hooks.BEFORE_INITIALIZE_FLAG`.
3. `LiquidityLocker(poolManager, launchpad, hook)`.
4. `launchpad.setUniswap(poolManager, hook, locker)` once.
5. `launchpad.setCca(lbpStrategy, positionManager)` once — this also calls `locker.setPositionManager`.

```bash
# dry-run (no --broadcast)
./script/run-sepolia.sh script/Deploy.s.sol

# local anvil (chain 31337): placeholders allowed when DEPLOYER_PRIVATE_KEY is unset
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545
```

Required off-anvil: `DEPLOYER_PRIVATE_KEY`, `PROTOCOL_FEE_RECIPIENT` (not `0xfee`), `WORLD_SIGNER_KEY` or `WORLD_SIGNER_ADDRESS` (not `0x51e`).

ENS: set `PARENT_USER_REGISTRY` to create the adapter, or set `ENS_ADAPTER_ADDRESS` to skip CREATE (not `0` / `0xe05` off anvil). A fork dry-run can use a no-code `ENS_ADAPTER_ADDRESS` override. Do not use a well-known Anvil EOA (`0xf39F…`, `0x7099…`, …) as that override on Sepolia: those accounts carry a 23-byte EIP-7702 designation, so `ens.code.length > 0` and the `adapter.launchpad()` check reverts. Use a no-code address such as `0x1234567890123456789012345678901234567890`.

Official addresses live in `SepoliaConfig.sol`. Optional env overrides: `UNISWAP_V4_POOL_MANAGER`, `LBP_STRATEGY`, `POSITION_MANAGER`, `CCA_FACTORY`, `INITIALIZER_HOOK`, `HOOK_SALT`.

After a send, paste `VITE_LAUNCHPAD_ADDRESS`, `VITE_LAUNCHPAD_DEPLOY_BLOCK`, `VITE_HOOK_ADDRESS`, `VITE_LOCKER_ADDRESS`, plus the LBP / CCA / PositionManager lines the script prints. Record: repo-root `deployments/sepolia.json`.
