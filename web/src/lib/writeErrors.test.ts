import { ContractFunctionExecutionError, ContractFunctionRevertedError, encodeErrorResult, UserRejectedRequestError } from "viem";
import { describe, expect, it } from "vitest";
import { ISSUE_COPY } from "./issue";
import { launchpadAbi } from "./launchpadAbi";
import { WRITE_REVERT_COPY, classifyWriteError } from "./writeErrors";
import { LaunchedParseError, WRITE_COPY, writeErrorMessage } from "./writes";

function revertNamed(errorName: string, functionName = "buy") {
  const data = encodeErrorResult({
    abi: launchpadAbi,
    errorName: errorName as "NullifierUsed",
  });
  return new ContractFunctionRevertedError({
    abi: launchpadAbi,
    functionName,
    data,
  });
}

function wrappedRevert(errorName: string, functionName = "buy") {
  return new ContractFunctionExecutionError(revertNamed(errorName, functionName), {
    abi: launchpadAbi,
    functionName,
  });
}

describe("classifyWriteError", () => {
  it("treats UserRejectedRequestError and code 4001 anywhere in the cause chain as rejected", () => {
    expect(classifyWriteError(new UserRejectedRequestError(new Error("denied")))).toEqual({
      kind: "rejected",
    });
    expect(classifyWriteError({ code: 4001, message: "User rejected the request." })).toEqual({
      kind: "rejected",
    });
    expect(classifyWriteError({ code: "4001" })).toEqual({ kind: "rejected" });
    expect(
      classifyWriteError({
        name: "TransactionExecutionError",
        cause: { name: "UserRejectedRequestError", code: 4001 },
      }),
    ).toEqual({ kind: "rejected" });
    expect(
      classifyWriteError({
        cause: { cause: new UserRejectedRequestError(new Error("cancelled")) },
      }),
    ).toEqual({ kind: "rejected" });
  });

  it("maps each Launchpad custom error name from ContractFunctionRevertedError.data.errorName", () => {
    const cases: [keyof typeof WRITE_REVERT_COPY, string][] = [
      ["NullifierUsed", WRITE_REVERT_COPY.NullifierUsed],
      ["LabelTaken", WRITE_REVERT_COPY.LabelTaken],
      ["AlreadyProphet", WRITE_REVERT_COPY.AlreadyProphet],
      ["SlugTaken", WRITE_REVERT_COPY.SlugTaken],
      ["Slippage", WRITE_REVERT_COPY.Slippage],
      ["CurveComplete", WRITE_REVERT_COPY.CurveComplete],
    ];
    for (const [name, message] of cases) {
      expect(classifyWriteError(wrappedRevert(name))).toEqual({
        kind: "revert",
        name,
        message,
      });
      expect(classifyWriteError({ data: { errorName: name } })).toEqual({
        kind: "revert",
        name,
        message,
      });
    }
  });

  it("treats an unmapped contract error name as unknown", () => {
    expect(classifyWriteError(wrappedRevert("ZeroAmount"))).toEqual({ kind: "unknown" });
    expect(classifyWriteError({ data: { errorName: "BadLabel" } })).toEqual({ kind: "unknown" });
    expect(classifyWriteError({ data: { errorName: "NotARealError" } })).toEqual({ kind: "unknown" });
  });

  it("does not invent a mapping from a plain Error message", () => {
    expect(classifyWriteError(new Error("NullifierUsed"))).toEqual({ kind: "unknown" });
    expect(classifyWriteError(new Error("Slippage"))).toEqual({ kind: "unknown" });
  });
});

describe("writeErrorMessage", () => {
  it("returns null for a wallet rejection", () => {
    expect(writeErrorMessage(new UserRejectedRequestError(new Error("denied")))).toBeNull();
    expect(writeErrorMessage({ code: 4001 }, "registerProphet")).toBeNull();
  });

  it("maps each named revert and keeps generic fallbacks by write source", () => {
    expect(writeErrorMessage(wrappedRevert("NullifierUsed"), "registerProphet")).toBe(
      "This World ID already has a name.",
    );
    expect(writeErrorMessage(wrappedRevert("LabelTaken"), "registerProphet")).toBe(
      "That name is taken. Try another.",
    );
    expect(writeErrorMessage(wrappedRevert("AlreadyProphet"), "registerProphet")).toBe(
      "This wallet already has a name.",
    );
    expect(writeErrorMessage(wrappedRevert("SlugTaken"))).toBe("That token name is taken. Try another.");
    expect(writeErrorMessage(wrappedRevert("Slippage"))).toBe("Price moved. Try again.");
    expect(writeErrorMessage(wrappedRevert("CurveComplete"))).toBe(
      "This token has graduated. Trade on Uniswap.",
    );
    expect(writeErrorMessage(new Error("registerProphet did not succeed"), "registerProphet")).toBe(
      ISSUE_COPY.registerFailed,
    );
    expect(writeErrorMessage(new Error("boom"))).toBe(WRITE_COPY.failed);
    expect(writeErrorMessage(wrappedRevert("ZeroAmount"))).toBe(WRITE_COPY.failed);
    expect(writeErrorMessage(new LaunchedParseError())).toBe(WRITE_COPY.launchedMissing);
  });
});
