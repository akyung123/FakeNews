import { describe, expect, it } from "vitest";
import { ccaFeatureFlags, envFlagOn } from "./config";

describe("CCA feature flags", () => {
  it("defaults migrate, swap, and collect on", () => {
    expect(ccaFeatureFlags({})).toEqual({ migrate: true, swap: true, collect: true });
    expect(ccaFeatureFlags({ VITE_CCA_MIGRATE: "", VITE_CCA_SWAP: "  ", VITE_CCA_COLLECT: undefined })).toEqual({
      migrate: true,
      swap: true,
      collect: true,
    });
  });

  it("turns a flag off with 0 or false", () => {
    expect(envFlagOn("0")).toBe(false);
    expect(envFlagOn("false")).toBe(false);
    expect(envFlagOn("1")).toBe(true);
    expect(envFlagOn("true")).toBe(true);
    expect(ccaFeatureFlags({ VITE_CCA_MIGRATE: "0" })).toMatchObject({ migrate: false, swap: true, collect: true });
    expect(ccaFeatureFlags({ VITE_CCA_SWAP: "false" })).toMatchObject({ migrate: true, swap: false, collect: true });
    expect(ccaFeatureFlags({ VITE_CCA_COLLECT: "0" })).toMatchObject({ migrate: true, swap: true, collect: false });
    expect(
      ccaFeatureFlags({
        VITE_CCA_MIGRATE: "false",
        VITE_CCA_SWAP: "0",
        VITE_CCA_COLLECT: "false",
      }),
    ).toEqual({ migrate: false, swap: false, collect: false });
  });
});
