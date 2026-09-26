import { describe, expect, it } from "vitest";
import { launchpadAbi } from "./launchpadAbi";

function entry(type: string, name?: string) {
  return launchpadAbi.find((item) => item.type === type && (!name || ("name" in item && item.name === name)));
}

describe("Launchpad ABI from #26", () => {
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

  it("exposes creatorFeeOf(wallet) → uint256", () => {
    const fn = entry("function", "creatorFeeOf");
    if (!fn || fn.type !== "function") throw new Error("missing creatorFeeOf");
    expect(fn.stateMutability).toBe("view");
    expect(fn.inputs.map((input) => [input.name, input.type])).toEqual([["wallet", "address"]]);
    expect(fn.outputs.map((output) => output.type)).toEqual(["uint256"]);
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

  it("includes the seven write-facing custom errors for revert decoding", () => {
    const names = launchpadAbi.filter((item) => item.type === "error").map((item) => item.name);
    const writeFacing = [
      "NullifierUsed",
      "LabelTaken",
      "AlreadyProphet",
      "SlugTaken",
      "Slippage",
      "CurveComplete",
      "ZeroAmount",
    ] as const;
    expect(writeFacing).toHaveLength(7);
    expect(writeFacing).toEqual([
      "NullifierUsed",
      "LabelTaken",
      "AlreadyProphet",
      "SlugTaken",
      "Slippage",
      "CurveComplete",
      "ZeroAmount",
    ]);
    for (const name of writeFacing) {
      expect(names).toContain(name);
    }
    for (const extra of [
      "InvalidSignature",
      "NotProphet",
      "MemoTooLong",
      "BadProphecy",
      "BadSlug",
      "BadLabel",
      "UnexpectedEth",
      "NotDeployer",
      "UniswapAlreadySet",
      "UniswapNotSet",
    ]) {
      expect(names).toContain(extra);
    }
  });

  it("constructor ends at ens; setUniswap is a deployer-only add-on", () => {
    const ctor = entry("constructor");
    if (!ctor || ctor.type !== "constructor") throw new Error("missing constructor");
    expect(ctor.inputs.map((input) => input.name)).toEqual([
      "protocolFeeRecipient",
      "worldSigner",
      "ens",
    ]);
    expect(ctor.inputs.some((input) => /pool|hook|locker|uniswap/i.test(input.name))).toBe(false);
    const setUniswap = entry("function", "setUniswap");
    if (!setUniswap || setUniswap.type !== "function") throw new Error("missing setUniswap");
    expect(setUniswap.inputs.map((input) => [input.name, input.type])).toEqual([
      ["poolManager", "address"],
      ["hook", "address"],
      ["locker", "address"],
    ]);
  });

  it("curve returns complete; Graduated carries poolId", () => {
    const curve = entry("function", "curve");
    if (!curve || curve.type !== "function") throw new Error("missing curve");
    expect(curve.outputs.map((output) => "name" in output && output.name)).toEqual([
      "vEth",
      "vToken",
      "realEth",
      "sold",
      "complete",
    ]);
    expect(launchpadAbi.some((item) => "name" in item && item.name === "getState")).toBe(false);

    const ev = entry("event", "Graduated");
    if (!ev || ev.type !== "event") throw new Error("missing Graduated");
    expect(ev.inputs.map((input) => input.name)).toEqual([
      "token",
      "poolId",
      "ethToPool",
      "tokensToPool",
      "sqrtPriceX96",
      "fee",
      "tickSpacing",
      "hooks",
    ]);
    const poolId = ev.inputs.find((input) => input.name === "poolId");
    expect(poolId?.indexed).toBe(true);
    expect(poolId?.type).toBe("bytes32");
  });
});
