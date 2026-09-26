import { describe, expect, it } from "vitest";
import { zeroAddress } from "viem";
import {
  CCA_SEPOLIA,
  addressesFromDeploymentRecord,
  missingCcaProductKeys,
  optionalAddress,
  resolveCcaProductAddresses,
} from "./addresses";

const LAUNCHPAD = "0x1111111111111111111111111111111111111111" as const;
const HOOK = "0x2222222222222222222222222222222222222222" as const;
const LOCKER = "0x3333333333333333333333333333333333333333" as const;

describe("CCA product addresses", () => {
  it("rejects empty and zero addresses", () => {
    expect(optionalAddress(undefined)).toBeUndefined();
    expect(optionalAddress("")).toBeUndefined();
    expect(optionalAddress(zeroAddress)).toBeUndefined();
    expect(optionalAddress(LAUNCHPAD)).toBe(LAUNCHPAD);
  });

  it("reads launchpad / hook / locker from deployments/sepolia.json fields", () => {
    expect(
      addressesFromDeploymentRecord({
        launchpad: LAUNCHPAD,
        hook: HOOK,
        locker: LOCKER,
      }),
    ).toMatchObject({
      launchpadAddress: LAUNCHPAD,
      hookAddress: HOOK,
      lockerAddress: LOCKER,
    });
    expect(
      addressesFromDeploymentRecord({
        contracts: { Launchpad: LAUNCHPAD, ProphecyHook: HOOK, LiquidityLocker: LOCKER },
      }),
    ).toMatchObject({
      launchpadAddress: LAUNCHPAD,
      hookAddress: HOOK,
      lockerAddress: LOCKER,
    });
  });

  it("lets VITE_* win over the bundled json, then fills official Uniswap pins", () => {
    const envLaunchpad = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
    const resolved = resolveCcaProductAddresses(
      { launchpadAddress: envLaunchpad },
      { launchpad: LAUNCHPAD, hook: HOOK, locker: LOCKER },
    );
    expect(resolved.launchpad).toBe(envLaunchpad);
    expect(resolved.hook).toBe(HOOK);
    expect(resolved.locker).toBe(LOCKER);
    expect(resolved.lbpStrategy).toBe(CCA_SEPOLIA.lbpStrategy);
    expect(resolved.ccaLens).toBe(CCA_SEPOLIA.ccaLens);
    expect(resolved.universalRouter).toBe(CCA_SEPOLIA.universalRouter);
    expect(resolved.poolManager).toBe(CCA_SEPOLIA.poolManager);
    expect(resolved.positionManager).toBe(CCA_SEPOLIA.positionManager);
    expect(resolved.permit2).toBe(CCA_SEPOLIA.permit2);
  });

  it("leaves product keys unset when only official pins exist", () => {
    const resolved = resolveCcaProductAddresses({}, {});
    expect(resolved.launchpad).toBeUndefined();
    expect(resolved.hook).toBeUndefined();
    expect(resolved.locker).toBeUndefined();
    expect(missingCcaProductKeys(resolved)).toEqual(["launchpad", "hook", "locker"]);
    expect(resolved.lbpStrategy).toBe(CCA_SEPOLIA.lbpStrategy);
  });
});
