# ENSv2 notes (Sepolia beta)

A summary of the official ENSv2 docs, for reference while building. The design is in [`SPEC.md`](SPEC.md) and [`DECISIONS.md`](DECISIONS.md).

- **Sources:** docs.ens.domains/ensv2 pages
  - Permissioned Registry
  - Permissioned Resolver
  - Enhanced Access Control
  - Guide for Contract Developers
  - Verifiable Factory
  - Registry Hierarchy
  - Registry Template
  - ETH Registrar
- **Doc sources:** github.com/ensdomains/docs `src/pages/ensv2/*.mdx`
- **Contracts:** github.com/ensdomains/contracts-v2 at commit `71a3b73`
- **Read on:** 2026-09-25. The docs say the contracts are "not yet final and may change".

## 0. Read this first

- **The official docs are the source of truth.** If another source disagrees, follow the docs.
- The deployment the docs reference is contracts-v2 commit `71a3b73` (deployed 2026-09-15). Its ABI matches the docs.
  - Checked: `setText(bytes name, ...)`, `initialize(grants, calls)`, `grantSetterRoles`, `linkToNode`, `isEmancipated`
- **Do not use older material.** `docs/addresses/sepolia.md` on the contracts-v2 main branch is an older beta deployed in June, with different addresses and function signatures.
- **Recheck addresses before deploying:** the "Sepolia (ENSv2 Beta)" table at docs.ens.domains/learn/deployments.
- ABIs: `contracts/deployments/sepolia/<Name>.json` at `71a3b73`.

### Sepolia addresses (`71a3b73`, deployed 2026-09-15)

| Contract | Address |
|---|---|
| RootRegistry | `0x9703dbd26dab89504490994138cf2c575251a9ce` |
| ETHRegistry (`.eth` registry) | `0x657ea849311d3d5823348dded7c2aaafb3ede09e` |
| ETHRegistrar (`.eth` registration) | `0xabe76f6c8dfced81aa5a2bb8034202a7136b94ca` |
| VerifiableFactory | `0x9e726eb570beb6bceb495ab8cda7df517d4e841c` |
| UserRegistryImpl | `0xa80338aaa8d23831cea25e858d1774534abb0263` |
| PermissionedResolverImpl | `0x14f09fd05d4585759e54844dc9b00147131cf243` |
| UniversalResolverV2 | `0x5d25c1d6acbb71b7a28aa7899618a3412a8303e3` |
| MockUSDC (pays registration, has `mint`) | `0x16f95d91dba7da3aca778ec053df0ff6c6a8aa8e` |

## 1. What changed from v1

- **v1**
  - One flat registry holds every name.
  - Permissions are Name Wrapper "fuses", and burning one is permanent.
- **v2**
  - **A tree**: every name can have its own registry (subregistry).
    - A name is one label inside one registry; `sub.nick.eth` is the chain `.eth → nick → sub`.
  - Permissions are **EAC roles** that can be granted and revoked.
    - Revoking a role together with its admin role locks it permanently.
  - One name = **one ERC1155 token** (single owner).
    - Its **token ID changes** when roles change or the name is re-registered.
- **Resolution**
  - Walk down from the root with `getSubregistry` / `getResolver`; **the deepest resolver wins**.
    - A name without a resolver inherits its nearest ancestor's (wildcard).
  - Apps just call the Universal Resolver: viem's `getEnsText` and `getEnsAddress` work unchanged.

## 2. Enhanced Access Control (EAC)

- **Resource:** what a permission applies to (`uint256`).
  - In a registry, one name. In a resolver, one argument such as a text key.
  - `ROOT_RESOURCE = 0` means the whole contract: a master key.
- **Role check:** passes if the role is held on the resource **or** on ROOT.
- **Bitmap layout**
  - Each role takes 4 bits (a nybble).
  - The low 128 bits hold 32 regular roles; the high 128 bits hold 32 admin roles.
  - admin role = `role << 128`.
- **Admin roles:** holders can grant and revoke the role (and the admin role itself), including revoking it from themselves.
- **Functions**
  - `grantRoles` / `revokeRoles(resource, bitmap, account)` reject ROOT.
  - ROOT uses `grantRootRoles` / `revokeRootRoles`.
- **Limit:** at most 15 accounts per role per resource.
- **Replacing fuses**
  - No transfers: revoke `ROLE_CAN_TRANSFER_ADMIN`.
  - Lock the resolver: revoke `ROLE_SET_RESOLVER`.
  - No new subnames: revoke `ROLE_REGISTRAR`.
- **Event:** `EACRolesChanged(resource, account, old, new)`

## 3. Permissioned Registry (UserRegistry)

### A name's entry (`Entry`)

`subregistry`, `expiry`, `resolver`, `eacVersionId`, `tokenVersionId`

### States

- `AVAILABLE`: never registered, or expired
- `RESERVED`: held without an owner
- `REGISTERED`: has an owner

### `register(label, owner, registry, resolver, roleBitmap, expiry)`

- The caller needs `ROLE_REGISTRAR` on ROOT.
- `roleBitmap` is **the roles given to the owner**. `0` means the owner can do nothing (allowed when there is an owner).
- `expiry` is an absolute timestamp. **`type(uint64).max` makes a permanent name.** `0` reverts with `CannotSetPastExpiry`.
- `owner = 0` reserves the name, and then `roleBitmap` must be 0.
- A registered name cannot be overwritten.

### Admin roles on a name can only be given at registration

- Afterwards only regular roles can be granted.
- So **the bitmap given at registration is the ceiling** for that name's permissions.

### Registry roles

| Role | Value | Scope |
|---|---|---|
| `ROLE_REGISTRAR` | `1<<0` | root |
| `ROLE_REGISTER_RESERVED` | `1<<4` | root |
| `ROLE_SET_PARENT` | `1<<8` | root |
| `ROLE_UNREGISTER` | `1<<12` | root / name |
| `ROLE_RENEW` | `1<<16` | root / name |
| `ROLE_SET_SUBREGISTRY` | `1<<20` | root / name |
| `ROLE_SET_RESOLVER` | `1<<24` | root / name |
| `ROLE_CAN_TRANSFER_ADMIN` | `(1<<28)<<128` | root / name (admin only, checked against the owner) |
| `ROLE_SET_URI` | `1<<36` | root |
| `ROLE_UPGRADE` | `1<<124` | root |

### Transfers

- The **owner** must hold `ROLE_CAN_TRANSFER_ADMIN`. Without it the name is non-transferable (soulbound).
- A transfer moves the owner's roles to the new owner.
- `safeTransferFrom` also reverts when:
  - the registry is not emancipated, or
  - someone other than the owner holds roles on the name.
- `unsafeTransfer` skips those two checks.

### Emancipation

- **Dangerous roles:** `SET_RESOLVER`, `SET_SUBREGISTRY`, `UNREGISTER` and `UPGRADE` on ROOT, plus their admins.
- When nobody holds a dangerous role, `isEmancipated() == true`. This is irreversible.
- `REGISTRAR` and `RENEW` are operational and do not affect emancipation (this is how the `.eth` registry works).
- **The level above must be locked too.** `sub.alice.eth` is only safe if `alice.eth` cannot swap its subregistry either.

### Parent pointer

- `setParent(parent, label)` records the parent.
- Revoking `ROLE_SET_PARENT` and its admin makes it permanent.
- The Universal Resolver uses this pointer to verify the canonical path.

### Namespace aliasing

- If two names point at the same subregistry, everything under them resolves the same way.

### Other

- **anyId:** a labelhash, token ID or resource all refer to the same name.
  - Index by **labelhash** and follow `TokenRegenerated` events.
- **Reads**
  - `getState(anyId)` → `{status, expiry, latestOwner, tokenId, resource}`
  - `getStatus`, `findOwner(label)`, `getResolver(label)`, `getSubregistry(label)`
  - `getResolver` and `getSubregistry` return `address(0)` once the name has expired.
- **Metadata:** `setURI(uri, renderer)`
  - `IRegistryURIRenderer.renderURI(registry, tokenId)` can build SVG or JSON on chain.
- **Events**
  - `LabelRegistered(tokenId, labelHash, label, owner, expiry, sender)`
  - `TokenResource`, `ResolverUpdated`, `SubregistryUpdated`, `TokenRegenerated`, `ExpiryUpdated`, `LabelUnregistered`

## 4. Permissioned Resolver

### Basics

- Each account (or any unit you choose) gets **its own resolver instance**, a UUPS proxy.
- Records are numbered bundles (records). A name is **linked** to a record ID.
- The first write creates a new record automatically.
- A name without its own record uses the root (`0x00`) record as its default.

### Writes

- **Setters take the DNS-encoded name** (`bytes`, viem: `toHex(packetToBytes(name))`).
  - `setText(name, key, value)`
  - `setAddress(name, coinType, bytes)`: ETH is coinType 60
  - `setData`, `setContenthash`, `setABI`, `setInterface`, `setName`
- **Links** (both need `ROLE_LINK` on root):
  - `linkToNode(name, targetNode)`: use the same record as another name (record aliasing)
  - `linkToRecord(name, id)`: link by record ID; `0` unlinks

### Reads

- There are no standalone getters. Values are read only through `resolve(name, data)`.
- Normally through the Universal Resolver (viem `getEnsText`).

### Resolver roles

- **Roles**
  - `ROLE_SET_ADDRESS 1<<0`
  - `ROLE_SET_TEXT 1<<4`
  - `ROLE_SET_CONTENTHASH 1<<8`
  - `ROLE_SET_ABI 1<<12`
  - `ROLE_SET_INTERFACE 1<<16`
  - `ROLE_SET_NAME 1<<20`
  - `ROLE_SET_DATA 1<<24`
  - `ROLE_LINK 1<<28`
  - `ROLE_CAN_NAME 1<<120`
  - `ROLE_UPGRADE 1<<124`
- **Scope**
  - Roles apply to **ROOT (the whole resolver) or one argument** (a text key, a coin type, ...).
  - **They cannot be scoped per name.** A text key permission covers every name that resolver serves.
  - To separate permissions per name, give that name **its own resolver**.
- **Granting**
  - One key: `grantSetterRoles(setter calldata, account)`.
    - Example: encode `setText("0x","avatar","")` to allow only the `avatar` key.
    - The caller must hold the matching admin role.
  - The whole resolver: `grantRootRoles`.
  - Revoke a per-argument role: `revokeRoles(keccak256(key), ROLE_SET_TEXT, account)`.
  - `grantRoles` is disabled.

### Permanent lock

- Revoke the setter role, `ROLE_LINK` and `ROLE_UPGRADE`, **each with its admin**.
- Revoking only the setter is not enough: `ROLE_LINK` can relink the name to another record, and `ROLE_UPGRADE` can replace the code.

### Deployment

- Deploy a proxy of `PermissionedResolverImpl` through VerifiableFactory.
- `initialize(grants, calls)`:
  - `grants`: each `{account, roleBitmap}` is granted on ROOT exactly as given.
  - `calls`: run as a multicall **without role checks**.
  - So **records written in `calls`, with no write role granted to anyone, are locked from the start.**
  - In code, `_checkRoles` is skipped during initialization. Whether `grantSetterRoles`' admin check is also skipped is unverified.
- **Events:** `Linked(recordId, node, name)`, `TextUpdated(recordId, keyHash, key, value)`, `AddressUpdated`, `ResourceArgument`

## 5. Verifiable Factory

- `deployProxy(implementation, salt, data)`
  - Uses CREATE2 with `outerSalt = keccak256(abi.encode(msg.sender, salt))`.
  - Each caller has its own salt space, so there are no collisions.
- **Event:** `ProxyDeployed(sender, proxyAddress, salt, implementation)`
- Proxies are 77 bytes, so they are **cheap**, and their addresses can be computed in advance.
- `verifyContract(proxy)` proves on chain that a proxy came from this factory.
- **Conventional salts**
  - Resolver: `keccak256("OwnedResolver", owner, version)`
  - Registry: `keccak256("UserRegistry", namehash, version)`
  - Our own contracts may use their own scheme.
- **Initializers**
  - UserRegistry: `initialize(Grant[] grants)`. At least one account must receive a ROOT role.
  - Resolver: `initialize(Grant[] grants, bytes[] calls)`

## 6. Building a subname registrar

From the "Guide for Contract Developers".

- **Split of responsibilities**
  - The registry stores names, tokens and permissions.
  - **The registrar** (our contract) handles price, conditions and validation, then calls the registry's `register`.
- **Steps**
  1. Have a parent name (`xxx.eth`).
  2. Deploy a UserRegistry proxy with VerifiableFactory. Include `ROLE_REGISTRAR_ADMIN` and `ROLE_RENEW_ADMIN` in the init bitmap.
  3. On ETHRegistry, call `setSubregistry(labelhash("xxx"), userRegistry)`. **Without this, names register but never resolve.**
  4. Deploy the registrar.
  5. Call `userRegistry.grantRootRoles(ROLE_REGISTRAR | ROLE_RENEW, registrar)`.
- **Foundry**
  - Install: `forge install ensdomains/contracts-v2`
  - Remappings:
    - `@ensdomains/contracts-v2/=lib/contracts-v2/contracts/src/`
    - `@openzeppelin/contracts/=lib/contracts-v2/contracts/lib/openzeppelin-contracts/contracts/`
  - Imports: `registry/interfaces/IPermissionedRegistry.sol`, `IRegistry.sol`, `registry/libraries/RegistryRolesLib.sol`
- **Registering a `.eth` name (ETHRegistrar)**
  1. `makeCommitment(label, owner, secret, subregistry, resolver, duration, referrer)`, then `commit`.
  2. Wait **60 seconds**.
  3. `register(..., paymentToken, referrer)`.
  - 5+ characters cost $8/year, paid in ERC20: `mint` and `approve` MockUSDC first.
  - The registrant receives `SET_SUBREGISTRY(+admin)`, `SET_RESOLVER(+admin)`, `CAN_TRANSFER_ADMIN`.
- **Indexing**
  - Watch both the registrar's and the registry's events.
  - Token IDs change, so key by labelhash.
- **Common errors**
  - `EACUnauthorizedAccountRoles`: the registrar was not granted `ROLE_REGISTRAR`.
  - `EACCannotGrantRoles`: the init bitmap is missing an admin role.
