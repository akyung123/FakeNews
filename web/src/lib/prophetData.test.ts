import { describe, expect, test } from "bun:test";
import { MOCK_PARENT_NAME, MOCK_PROPHECIES, MOCK_PROPHETS } from "./mock";
import {
  curveProgress,
  getProphecyByName,
  getProphetPage,
  normalizeProphetLabel,
  prophecyDetailPath,
  prophecyEnsName,
  prophetEnsName,
  prototypeCoinFromName,
} from "./prophetData";

const NOW = 1_750_000_000;

describe("normalizeProphetLabel", () => {
  test("accepts a label or a full prophet name", () => {
    expect(normalizeProphetLabel("ringo")).toBe("ringo");
    expect(normalizeProphetLabel("Ringo.Prophecy.eth")).toBe("ringo");
    expect(normalizeProphetLabel("ringo.prophecy.eth")).toBe("ringo");
  });

  test("rejects a prophecy name and an empty string", () => {
    expect(normalizeProphetLabel("badges-2028.ringo.prophecy.eth")).toBeNull();
    expect(normalizeProphetLabel("")).toBeNull();
    expect(normalizeProphetLabel("prophecy.eth")).toBeNull();
  });
});

describe("getProphetPage", () => {
  test("loads ringo from a label or ENS name", () => {
    const byLabel = getProphetPage("ringo");
    const byName = getProphetPage("ringo.prophecy.eth");
    expect(byLabel).not.toBeNull();
    expect(byName).not.toBeNull();
    expect(byLabel?.prophet.ensName).toBe(prophetEnsName("ringo"));
    expect(byLabel?.prophet.wallet).toBe(MOCK_PROPHETS[0].wallet);
    expect(byName?.prophet.wallet).toBe(byLabel?.prophet.wallet);
  });

  test("lists slug.name.prophecy.eth children with sentences from the mock", () => {
    const page = getProphetPage("ringo");
    expect(page).not.toBeNull();
    const ringoRows = MOCK_PROPHECIES.filter((row) => row.prophetLabel === "ringo");
    expect(page!.prophecies).toHaveLength(ringoRows.length);
    for (const row of ringoRows) {
      const got = page!.prophecies.find((p) => p.slug === row.slug);
      expect(got).toBeDefined();
      expect(got!.sentence).toBe(row.sentence);
      expect(got!.ensName).toBe(prophecyEnsName(row.slug, "ringo"));
      expect(got!.ensName.endsWith(`.${MOCK_PARENT_NAME}`)).toBe(true);
      expect(got!.token).toBe(row.token);
    }
  });

  test("marks graduation from the curve only", () => {
    const page = getProphetPage("ringo")!;
    const graduated = page.prophecies.filter((p) => p.complete);
    expect(graduated.map((p) => p.slug)).toEqual(["two-min"]);
    expect(graduated[0].curveProgress).toBe(1);
  });

  test("returns null for an unknown prophet", () => {
    expect(getProphetPage("nobody")).toBeNull();
  });

  test("keeps mina separate from ringo", () => {
    const mina = getProphetPage("mina")!;
    expect(mina.prophecies).toHaveLength(1);
    expect(mina.prophecies[0].ensName).toBe("name-points.mina.prophecy.eth");
    expect(mina.claimableFeeWei).toBe(0n);
  });
});

describe("curveProgress", () => {
  test("is 0 at the start, 1 when complete, and a fraction in between", () => {
    expect(curveProgress(0n, false)).toBe(0);
    expect(curveProgress(793_100_000n * 10n ** 18n, false)).toBe(1);
    expect(curveProgress(1n, true)).toBe(1);
    expect(curveProgress(317_240_000n * 10n ** 18n, false)).toBeCloseTo(0.4, 4);
  });
});

describe("prophecyDetailPath", () => {
  test("points at the Screen 3 name route", () => {
    expect(prophecyDetailPath("badges-2028.ringo.prophecy.eth")).toBe(
      "/n/badges-2028.ringo.prophecy.eth",
    );
  });
});

describe("getProphecyByName", () => {
  test("resolves a full ENS name or a slug", () => {
    const byEns = getProphecyByName("badges-2028.ringo.prophecy.eth");
    const bySlug = getProphecyByName("badges-2028");
    expect(byEns?.sentence).toBe("Every hackathon badge is an ENS name by 2028");
    expect(byEns?.ensName).toBe("badges-2028.ringo.prophecy.eth");
    expect(bySlug?.ensName).toBe(byEns?.ensName);
    expect(getProphecyByName("missing.ringo.prophecy.eth")).toBeNull();
  });

  test("maps that name onto the prototype Screen 3 coin shape", () => {
    const coin = prototypeCoinFromName("badges-2028.ringo.prophecy.eth", NOW);
    expect(coin).not.toBeNull();
    expect(coin!.prophecy).toBe("Every hackathon badge is an ENS name by 2028");
    expect(coin!.name).toBe("badges-2028.ringo.prophecy.eth");
  });
});
