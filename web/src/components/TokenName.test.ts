import { describe, expect, it } from "vitest";
import { tokenDisplayName } from "./TokenName";

describe("tokenDisplayName", () => {
  it("keeps an explicit slug and full ENS name", () => {
    expect(
      tokenDisplayName({ slug: "lingo-2028", ensName: "lingo-2028.ringo.prophecy.eth" }),
    ).toEqual({ slug: "lingo-2028", ensName: "lingo-2028.ringo.prophecy.eth" });
  });

  it("reads the slug from a full ENS token name", () => {
    expect(tokenDisplayName({ name: "badges-2028.ringo.prophecy.eth" })).toEqual({
      slug: "badges-2028",
      ensName: "badges-2028.ringo.prophecy.eth",
    });
  });

  it("uses slugOf when the token name is not an ENS name", () => {
    expect(tokenDisplayName({ id: "wifi", name: "Wifi Dies" })).toEqual({
      slug: "Wifi Dies",
      ensName: null,
    });
  });
});
