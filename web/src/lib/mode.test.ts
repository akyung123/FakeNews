import { describe, expect, it } from "vitest";
import { isMockMode } from "./mode";
import { hasLaunchpad } from "./contracts";

describe("data mode", () => {
  it("is mock when the launchpad address is unset", () => {
    expect(hasLaunchpad()).toBe(false);
    expect(isMockMode()).toBe(true);
  });
});
