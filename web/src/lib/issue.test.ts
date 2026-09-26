import { beforeEach, describe, expect, it } from "vitest";
import {
  clearLaunchDraft,
  isIssueFormValid,
  isIssueSubmitEnabled,
  isLaunchEnabled,
  isRegisterSubmitEnabled,
  isValidProphetLabel,
  isValidProphecy,
  isValidSlug,
  ISSUE_COPY,
  launchButtonLabel,
  prophecyName,
  readLaunchDraft,
  readStoredProphetLabel,
  storeLaunchDraft,
  storeProphetLabel,
  registerRevertName,
  worldErrorKindFromRegisterProphet,
  worldErrorMessage,
  worldUserMessage,
} from "./issue";
import { ContractFunctionRevertedError, encodeErrorResult } from "viem";
import { launchpadAbi } from "./launchpadAbi";
import { WRITE_REVERT_COPY } from "./writeErrors";
import { writeErrorMessage } from "./writes";

/** What viem throws for a Launchpad custom error, wrapped the way writeContract wraps it. */
function launchpadRevert(errorName: string) {
  const data = encodeErrorResult({ abi: launchpadAbi, errorName: errorName as "NullifierUsed" });
  return {
    name: "ContractFunctionExecutionError",
    message: "execution reverted",
    cause: new ContractFunctionRevertedError({ abi: launchpadAbi, functionName: "registerProphet", data }),
  };
}

describe("register and launch reverts by errorName", () => {
  it("classifies each Launchpad error from the decoded revert, not the message", () => {
    for (const name of ["NullifierUsed", "AlreadyProphet", "LabelTaken", "InvalidSignature", "ProphetRecipient"]) {
      expect(registerRevertName(launchpadRevert(name))).toBe(name);
    }
    expect(registerRevertName(new Error("AlreadyProphet"))).toBeNull();
    expect(registerRevertName({ code: 4001 })).toBeNull();
    expect(registerRevertName(launchpadRevert("SlugTaken"))).toBeNull();
  });

  it("gives each one its own banner", () => {
    expect(writeErrorMessage(launchpadRevert("InvalidSignature"), "registerProphet")).toBe(
      WRITE_REVERT_COPY.InvalidSignature,
    );
    expect(writeErrorMessage(launchpadRevert("ProphetRecipient"))).toBe(
      "This wallet receives protocol fees and can't launch.",
    );
    expect(writeErrorMessage(launchpadRevert("AlreadyProphet"), "registerProphet")).toBe(
      WRITE_REVERT_COPY.AlreadyProphet,
    );
  });
});

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

  it("builds the nested prophecy name", () => {
    expect(prophecyName("lingo-2028", "ringo", "prophecy.eth")).toBe("lingo-2028.ringo.prophecy.eth");
  });
});

describe("launch button gating", () => {
  const valid = {
    prophetLabel: "ringo",
    prophecy: "The projector survives the demo",
    slug: "lingo-2028",
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
    expect(launchButtonLabel({ returningProphet: false, worldStatus: "idle" })).toBe(ISSUE_COPY.disabledLaunch);
    expect(launchButtonLabel({ returningProphet: false, worldStatus: "pending" })).toBe(ISSUE_COPY.disabledLaunch);
    expect(launchButtonLabel({ returningProphet: false, worldStatus: "cancelled" })).toBe(
      ISSUE_COPY.disabledLaunch,
    );
  });

  it("claims the name in step 1, then launches with the same button in step 2", () => {
    expect(launchButtonLabel({ returningProphet: false, worldStatus: "success" })).toBe("Claim your name");
    expect(
      launchButtonLabel({ returningProphet: false, worldStatus: "success", registerStatus: "pending" }),
    ).toBe(ISSUE_COPY.register);
    expect(
      launchButtonLabel({ returningProphet: false, worldStatus: "success", registerStatus: "success" }),
    ).toBe("Launch prophecy");
    expect(launchButtonLabel({ returningProphet: true, worldStatus: "idle" })).toBe("Launch prophecy");
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

  it("maps a Launchpad nullifier reuse revert to one-human-one-name by errorName", () => {
    expect(worldErrorKindFromRegisterProphet(launchpadRevert("NullifierUsed"))).toBe("nullifier_reuse");
    // Message text alone is never trusted: only the decoded revert name counts.
    expect(worldErrorKindFromRegisterProphet(new Error("nullifier already used"))).toBe("network");
    expect(worldErrorKindFromRegisterProphet(new Error("NullifierUsed"))).toBe("network");
    expect(worldErrorKindFromRegisterProphet(launchpadRevert("LabelTaken"))).toBe("network");
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
    expect(ISSUE_COPY.pending).toBe("Still checking. The first check can take up to a minute.");
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

describe("World server blocked copy", () => {
  it("tells the person to turn off an ad blocker when the World server can't be reached", () => {
    expect(worldUserMessage("blocked")).toBe(
      "We can't reach the World server. If you use an ad blocker, turn it off for this site and try again.",
    );
  });
});

describe("launch draft storage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("round-trips the three inputs through sessionStorage", () => {
    expect(readLaunchDraft()).toBeNull();
    storeLaunchDraft({ prophetLabel: "mina", prophecy: "Coffee lasts", slug: "coffee-last" });
    expect(readLaunchDraft()).toEqual({ prophetLabel: "mina", prophecy: "Coffee lasts", slug: "coffee-last" });
  });

  it("drops the draft when it is cleared or emptied", () => {
    storeLaunchDraft({ prophetLabel: "mina", prophecy: "Coffee lasts", slug: "coffee-last" });
    clearLaunchDraft();
    expect(readLaunchDraft()).toBeNull();
    storeLaunchDraft({ prophetLabel: "mina", prophecy: "", slug: "" });
    storeLaunchDraft({ prophetLabel: "", prophecy: "", slug: "" });
    expect(readLaunchDraft()).toBeNull();
  });

  it("ignores a malformed draft", () => {
    sessionStorage.setItem("prophecy:launch-draft", "{not json");
    expect(readLaunchDraft()).toBeNull();
    sessionStorage.setItem("prophecy:launch-draft", JSON.stringify({ prophecy: 3, slug: "coffee-last" }));
    expect(readLaunchDraft()).toEqual({ prophetLabel: "", prophecy: "", slug: "coffee-last" });
  });
});

describe("prophet name cache", () => {
  const A = "0xC0ffee254729296a45a3885639AC7E10F9d54979";
  const B = "0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E";

  it("keeps one name per wallet in localStorage", () => {
    localStorage.clear();
    storeProphetLabel(A, "mina");
    expect(readStoredProphetLabel(A)).toBe("mina");
    expect(readStoredProphetLabel(A.toLowerCase())).toBe("mina");
    expect(readStoredProphetLabel(B)).toBeNull();
    storeProphetLabel(B, "ringo");
    expect(readStoredProphetLabel(A)).toBe("mina");
    expect(readStoredProphetLabel(B)).toBe("ringo");
    expect(JSON.parse(localStorage.getItem("prophecy:prophet-label")!)).toEqual({
      [A.toLowerCase()]: "mina",
      [B.toLowerCase()]: "ringo",
    });
    expect(sessionStorage.getItem("prophecy:prophet-label")).toBeNull();
    localStorage.clear();
  });

  it("ignores an old single-name value that is not tied to a wallet", () => {
    localStorage.setItem("prophecy:prophet-label", "mina");
    expect(readStoredProphetLabel(A)).toBeNull();
    storeProphetLabel(A, "ringo");
    expect(readStoredProphetLabel(A)).toBe("ringo");
    localStorage.clear();
  });
});
