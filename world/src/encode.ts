import { encodeAbiParameters, keccak256, type Address, type Hex } from "viem";

/**
 * INTERFACE.md section 3 signed-message encoding:
 *   keccak256(abi.encode(chainId, launchpad, wallet, nullifier))
 * then that 32-byte hash is signed with EIP-191.
 */
export const SIGNED_PAYLOAD_ABI = [
  { name: "chainId", type: "uint256" },
  { name: "launchpad", type: "address" },
  { name: "wallet", type: "address" },
  { name: "nullifier", type: "uint256" },
] as const;

export type RegisterPayload = {
  chainId: bigint;
  launchpad: Address;
  wallet: Address;
  nullifier: bigint;
};

export function encodeRegisterBytes(payload: RegisterPayload): Hex {
  return encodeAbiParameters(SIGNED_PAYLOAD_ABI, [
    payload.chainId,
    payload.launchpad,
    payload.wallet,
    payload.nullifier,
  ]);
}

export function hashRegisterPayload(payload: RegisterPayload): Hex {
  return keccak256(encodeRegisterBytes(payload));
}
