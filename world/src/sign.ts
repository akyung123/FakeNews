import { recoverMessageAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hashRegisterPayload, type RegisterPayload } from "./encode.ts";

export async function signRegisterPayload(signerKey: Hex, payload: RegisterPayload): Promise<Hex> {
  const account = privateKeyToAccount(signerKey);
  return account.signMessage({ message: { raw: hashRegisterPayload(payload) } });
}

export async function recoverRegisterSigner(payload: RegisterPayload, signature: Hex): Promise<Address> {
  return recoverMessageAddress({
    message: { raw: hashRegisterPayload(payload) },
    signature,
  });
}
