import { describe, expect, it } from "vitest";
import {
  fromDatetimeLocalValue,
  isIssueFormValid,
  isIssueSubmitEnabled,
  isLaunchEnabled,
  isRegisterSubmitEnabled,
  isValidDeadline,
  isValidFirstBuy,
  isValidProphetLabel,
  isValidProphecy,
  isValidSlug,
  ISSUE_COPY,
  launchButtonLabel,
  prophecyName,
  toDatetimeLocalValue,
  worldErrorKindFromRegisterProphet,
  worldErrorMessage,
  worldUserMessage,
} from "./issue";

describe("issue field rules", () => {
  it("accepts prophet labels of 3–16 [a-z0-9]", () => {
    expect(isValidProphetLabel("ringo")).toBe(true);
    expect(isValidProphetLabel("ab")).toBe(false);
    expect(isValidProphetLabel("Ringo")).toBe(false);
    expect(isValidProphetLabel("ringo-1")).toBe(false);
  });

  it("accepts slugs of 3–32 [a-z0-9-] without edge hyphens", () => {
    expect(isValidSlug("lingo-2028")).toBe(true);
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("-lingo")).toBe(false);
    expect(isValidSlug("lingo-")).toBe(false);
  });

  it("requires a one-line prophecy of 1–140 UTF-8 bytes", () => {
    expect(isValidProphecy("x")).toBe(true);
    expect(isValidProphecy("")).toBe(false);
    expect(isValidProphecy("  ")).toBe(false);
    expect(isValidProphecy("x".repeat(141))).toBe(false);
    expect(isValidProphecy("한".repeat(46))).toBe(true);
    expect(isValidProphecy("한".repeat(47))).toBe(false);
  });

  it("requires a deadline in the future", () => {
    expect(isValidDeadline(100, 99)).toBe(true);
    expect(isValidDeadline(100, 100)).toBe(false);
  });

  it("treats first buy as optional and non-negative", () => {
    expect(isValidFirstBuy("")).toBe(true);
    expect(isValidFirstBuy("0")).toBe(true);
    expect(isValidFirstBuy("-1")).toBe(false);
  });

  it("builds the nested prophecy name", () => {
    expect(prophecyName("lingo-2028", "ringo", "prophecy.eth")).toBe("lingo-2028.ringo.prophecy.eth");
  });

  it("round-trips datetime-local values", () => {
    const ms = Date.parse("2026-09-26T12:30:00");
    expect(fromDatetimeLocalValue(toDatetimeLocalValue(ms))).toBe(Math.floor(ms / 1000));
  });
});

describe("launch button gating", () => {
  const valid = {
    prophetLabel: "ringo",
    prophecy: "The projector survives the demo",
    slug: "lingo-2028",
    deadlineUnix: 200,
    firstBuy: "0",
    nowSeconds: 100,
  };

  it("stays off for a first-time prophet until World succeeds", () => {
    expect(isIssueFormValid(valid)).toBe(true);
    expect(isIssueSubmitEnabled({ returningProphet: false, worldStatus: "idle", formValid: true })).toBe(false);
    expect(isIssueSubmitEnabled({ returningProphet: false, worldStatus: "pending", formValid: true })).toBe(false);
    expect(isIssueSubmitEnabled({ returningProphet: false, worldStatus: "cancelled", formValid: true })).toBe(false);
    expect(isIssueSubmitEnabled({ returningProphet: false, worldStatus: "failed", formValid: true })).toBe(false);
    expect(isRegisterSubmitEnabled({ returningProphet: false, worldStatus: "success", formValid: true })).toBe(true);
    expect(isLaunchEnabled({ returningProphet: false, worldStatus: "success", formValid: true })).toBe(false);
  });

  it("hides launch until the name is on chain", () => {
    expect(isLaunchEnabled({ returningProphet: false, worldStatus: "success", formValid: true })).toBe(false);
    expect(
      isLaunchEnabled({
        returningProphet: false,
        worldStatus: "success",
        formValid: true,
        registerStatus: "success",
      }),
    ).toBe(true);
    expect(isRegisterSubmitEnabled({ returningProphet: true, worldStatus: "idle", formValid: true })).toBe(false);
  });

  it("stays off when the form is incomplete even after success", () => {
    expect(isLaunchEnabled({ returningProphet: false, worldStatus: "success", formValid: false })).toBe(false);
    expect(isIssueSubmitEnabled({ returningProphet: false, worldStatus: "success", formValid: false })).toBe(false);
  });

  it("skips World for a returning prophet", () => {
    expect(isLaunchEnabled({ returningProphet: true, worldStatus: "idle", formValid: true })).toBe(true);
    expect(isLaunchEnabled({ returningProphet: true, worldStatus: "cancelled", formValid: true })).toBe(true);
    expect(worldErrorMessage("cancelled", true)).toBeNull();
  });

  it("uses the designer disabled label until World succeeds", () => {
    expect(
      launchButtonLabel({ returningProphet: false, worldStatus: "idle", canLaunch: false }),
    ).toBe(ISSUE_COPY.disabledLaunch);
    expect(
      launchButtonLabel({ returningProphet: false, worldStatus: "pending", canLaunch: false }),
    ).toBe(ISSUE_COPY.disabledLaunch);
    expect(
      launchButtonLabel({ returningProphet: false, worldStatus: "cancelled", canLaunch: false }),
    ).toBe(ISSUE_COPY.disabledLaunch);
    expect(
      launchButtonLabel({
        returningProphet: false,
        worldStatus: "success",
        canLaunch: false,
        canRegister: true,
      }),
    ).toBe(ISSUE_COPY.launch);
  });
});

describe("designer World copy mapping", () => {
  const codes = ["cancelled", "portal_rejected", "malformed_payload", "nullifier_reuse"] as const;

  it("maps cancel to the locked-until-verify sentence", () => {
    expect(worldUserMessage("cancelled")).toBe(
      "Verification cancelled. Launching stays locked until you verify.",
    );
  });

  it("maps portal_rejected without showing the code", () => {
    const text = worldUserMessage("portal_rejected");
    expect(text).toBe("World ID couldn't confirm this check. Try again in World App.");
    expect(text).not.toMatch(/portal_rejected/);
  });

  it("maps malformed_payload and network to the same retry sentence", () => {
    expect(worldUserMessage("malformed_payload")).toBe(
      "Something went wrong with the check. Please try again.",
    );
    expect(worldUserMessage("network")).toBe("Something went wrong with the check. Please try again.");
    expect(worldUserMessage("malformed_payload")).not.toMatch(/malformed_payload/);
    expect(worldUserMessage("malformed_payload")).not.toMatch(/context_mismatch/);
  });

  it("maps a Launchpad nullifier reuse revert to one-human-one-name", () => {
    expect(worldErrorKindFromRegisterProphet(new Error("NullifierUsed"))).toBe("nullifier_reuse");
    expect(worldErrorKindFromRegisterProphet(new Error("nullifier already used"))).toBe("nullifier_reuse");
    expect(worldUserMessage("nullifier_reuse")).toBe(
      "This human already has a prophet name. One human, one name.",
    );
  });

  it("never puts a raw server or revert code in designer copy", () => {
    for (const kind of codes) {
      const text = worldUserMessage(kind) ?? "";
      expect(text).not.toContain("portal_rejected");
      expect(text).not.toContain("malformed_payload");
      expect(text).not.toContain("NullifierUsed");
    }
    expect(worldErrorMessage("cancelled", false)).toBe(ISSUE_COPY.cancelled);
    expect(worldErrorMessage("idle", false)).toBeNull();
    expect(worldErrorMessage("pending", false)).toBeNull();
  });

  it("does not use the retry sentence while a check is still running", () => {
    expect(ISSUE_COPY.pending).toBe("Still checking. This can take a minute the first time.");
    expect(ISSUE_COPY.pending).not.toBe(ISSUE_COPY.checkFailed);
    expect(worldUserMessage("network")).toBe(ISSUE_COPY.checkFailed);
  });

  it("uses the designer name-claim sentences, without prediction-market wording", () => {
    expect(ISSUE_COPY.registerPending).toBe("Confirm your name in your wallet.");
    expect(ISSUE_COPY.registerSuccess).toBe("Your name is claimed on Sepolia.");
    expect(ISSUE_COPY.registerFailed).toBe(
      "Name claim failed. Nothing was charged except gas. Try again.",
    );
    const text = `${ISSUE_COPY.registerPending} ${ISSUE_COPY.registerSuccess} ${ISSUE_COPY.registerFailed}`.toLowerCase();
    expect(text).not.toMatch(/coin|profit|yield|prediction|true|false/);
  });
});
