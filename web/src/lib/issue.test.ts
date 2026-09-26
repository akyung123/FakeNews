import { describe, expect, it } from "vitest";
import {
  fromDatetimeLocalValue,
  isIssueFormValid,
  isLaunchEnabled,
  isValidDeadline,
  isValidFirstBuy,
  isValidProphetLabel,
  isValidProphecy,
  isValidSlug,
  ISSUE_COPY,
  prophecyName,
  toDatetimeLocalValue,
  worldErrorMessage,
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

  it("requires a one-line prophecy of 1–140 characters", () => {
    expect(isValidProphecy("x")).toBe(true);
    expect(isValidProphecy("")).toBe(false);
    expect(isValidProphecy("  ")).toBe(false);
    expect(isValidProphecy("x".repeat(141))).toBe(false);
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
    expect(isLaunchEnabled({ returningProphet: false, worldStatus: "idle", formValid: true })).toBe(false);
    expect(isLaunchEnabled({ returningProphet: false, worldStatus: "cancelled", formValid: true })).toBe(false);
    expect(isLaunchEnabled({ returningProphet: false, worldStatus: "failed", formValid: true })).toBe(false);
    expect(isLaunchEnabled({ returningProphet: false, worldStatus: "success", formValid: true })).toBe(true);
  });

  it("stays off when the form is incomplete even after success", () => {
    expect(isLaunchEnabled({ returningProphet: false, worldStatus: "success", formValid: false })).toBe(false);
  });

  it("skips World for a returning prophet", () => {
    expect(isLaunchEnabled({ returningProphet: true, worldStatus: "idle", formValid: true })).toBe(true);
    expect(isLaunchEnabled({ returningProphet: true, worldStatus: "cancelled", formValid: true })).toBe(true);
    expect(worldErrorMessage("cancelled", true)).toBeNull();
  });

  it("shows a clear English error on cancel or fail", () => {
    expect(worldErrorMessage("cancelled", false)).toBe(ISSUE_COPY.cancelled);
    expect(worldErrorMessage("failed", false)).toBe(ISSUE_COPY.failed);
    expect(worldErrorMessage("idle", false)).toBeNull();
  });
});
