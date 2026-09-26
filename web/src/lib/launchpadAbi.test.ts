import { describe, expect, it } from "vitest";
import { launchpadAbi } from "./launchpadAbi";

function entry(type: string, name?: string) {
  return launchpadAbi.find((item) => item.type === type && (!name || ("name" in item && item.name === name)));
}

describe("Launchpad ABI from #25", () => {
  it("constructor is (protocolFeeRecipient, worldSigner, ens)", () => {
    const ctor = entry("constructor");
    expect(ctor).toBeDefined();
    if (!ctor || ctor.type !== "constructor") throw new Error("missing constructor");
    expect(ctor.inputs.map((input) => [input.name, input.type])).toEqual([
      ["protocolFeeRecipient", "address"],
      ["worldSigner", "address"],
      ["ens", "address"],
    ]);
  });

  it("exposes ens() and prophetOf(wallet) → label", () => {
    const ens = entry("function", "ens");
    expect(ens).toBeDefined();
    if (!ens || ens.type !== "function") throw new Error("missing ens");
    expect(ens.stateMutability).toBe("view");
    expect(ens.inputs).toEqual([]);

    const prophetOf = entry("function", "prophetOf");
    if (!prophetOf || prophetOf.type !== "function") throw new Error("missing prophetOf");
    expect(prophetOf.inputs.map((input) => input.name)).toEqual(["wallet"]);
    expect(prophetOf.outputs.map((output) => "name" in output && output.name)).toEqual(["label"]);
  });

  it("registerProphet is { label, nullifier, serverSig }", () => {
    const fn = entry("function", "registerProphet");
    if (!fn || fn.type !== "function") throw new Error("missing registerProphet");
    expect(fn.inputs.map((input) => [input.name, input.type])).toEqual([
      ["label", "string"],
      ["nullifier", "uint256"],
      ["serverSig", "bytes"],
    ]);
  });

  it("Launched carries prophetLabel and slug, not deadline", () => {
    const ev = entry("event", "Launched");
    if (!ev || ev.type !== "event") throw new Error("missing Launched");
    expect(ev.inputs.map((input) => input.name)).toEqual(["token", "prophet", "prophetLabel", "slug"]);
    expect(ev.inputs.some((input) => input.name === "deadline")).toBe(false);
  });

  it("does not take Uniswap addresses in the constructor and has no setUniswap yet", () => {
    const ctor = entry("constructor");
    if (!ctor || ctor.type !== "constructor") throw new Error("missing constructor");
    expect(ctor.inputs.some((input) => /pool|hook|locker|uniswap/i.test(input.name))).toBe(false);
    expect(launchpadAbi.some((item) => "name" in item && item.name === "setUniswap")).toBe(false);
  });
});
