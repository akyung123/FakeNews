import { describe, expect, test } from "bun:test";
import { ensParts, isEnsName, slugOf } from "./ensName";

describe("ensParts / slugOf", () => {
  test("splits a prophecy token name into slug and labels", () => {
    const parts = ensParts("lingo-2028.ringo.prophecy.eth");
    expect(parts.slug).toBe("lingo-2028");
    expect(parts.name).toBe("lingo-2028.ringo.prophecy.eth");
    expect(parts.labels).toEqual(["lingo-2028", "ringo", "prophecy", "eth"]);
    expect(slugOf("lingo-2028.ringo.prophecy.eth")).toBe("lingo-2028");
    expect(isEnsName("lingo-2028.ringo.prophecy.eth")).toBe(true);
  });

  test("treats a prophet name as slug plus parent labels", () => {
    expect(slugOf("ringo.prophecy.eth")).toBe("ringo");
    expect(ensParts("ringo.prophecy.eth").labels).toEqual(["ringo", "prophecy", "eth"]);
  });

  test("a name with no dots is its own slug", () => {
    expect(slugOf("Wifi Dies")).toBe("Wifi Dies");
    expect(ensParts("Wifi Dies").labels).toEqual(["Wifi Dies"]);
    expect(isEnsName("Wifi Dies")).toBe(false);
  });

  test("trims and drops empty labels", () => {
    expect(slugOf("  badges-2028.ringo.prophecy.eth  ")).toBe("badges-2028");
    expect(ensParts("").slug).toBe("");
    expect(ensParts("...").labels).toEqual([]);
  });
});
