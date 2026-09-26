import { launchpadAbi } from "./launchpadAbi";
import { contracts, hasLaunchpad } from "./contracts";
import type { Hex } from "./world";

/** Launchpad.registerProphet calldata. Label is chosen by the caller, not signed. */
export type RegisterProphetInput = {
  label: string;
  nullifier: Hex;
  serverSig: Hex;
};

export function registerProphetArgs(input: RegisterProphetInput) {
  return [input.label, BigInt(input.nullifier), input.serverSig] as const;
}

export function registerProphetWrite(input: RegisterProphetInput, address = contracts.launchpad) {
  if (!address) {
    throw new Error("Launchpad address is not set");
  }
  return {
    address,
    abi: launchpadAbi,
    functionName: "registerProphet" as const,
    args: registerProphetArgs(input),
  };
}

/**
 * Screen 2 write. Missing launchpad address → no-op so mock mode still issues.
 * Label is not in the world/ signed payload (INTERFACE §3).
 */
export function createRegisterProphet(
  write?: (request: ReturnType<typeof registerProphetWrite>) => Promise<unknown>,
): (input: RegisterProphetInput) => Promise<void> {
  return async (input) => {
    if (!hasLaunchpad()) return;
    const request = registerProphetWrite(input);
    if (write) await write(request);
  };
}
