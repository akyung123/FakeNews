import { describe, expect, it } from "vitest";
import { hasLaunchpad } from "./contracts";
import { isCcaDemoMode, isMockMode, REQUIRED_CCA_ADDRESS_KEYS, requiredCcaAddressesReady } from "./mode";

const LAUNCHPAD = "0x1111111111111111111111111111111111111111" as const;

describe("data mode", () => {
  it("is mock when the launchpad address is unset", () => {
    expect(hasLaunchpad()).toBe(false);
    expect(isMockMode()).toBe(true);
    expect(isCcaDemoMode()).toBe(true);
  });

  it("uses demo mode only when the required launchpad address is missing", () => {
    expect(REQUIRED_CCA_ADDRESS_KEYS).toEqual(["launchpad"]);
    expect(requiredCcaAddressesReady({ launchpad: undefined })).toBe(false);
    expect(isCcaDemoMode({ launchpad: undefined })).toBe(true);
    expect(requiredCcaAddressesReady({ launchpad: LAUNCHPAD })).toBe(true);
    expect(isCcaDemoMode({ launchpad: LAUNCHPAD })).toBe(false);
    expect(isMockMode()).toBe(isCcaDemoMode());
  });

  it("does not treat official Uniswap pins as a live deploy", () => {
    expect(isCcaDemoMode({ launchpad: undefined })).toBe(true);
    expect(hasLaunchpad()).toBe(false);
  });
});

