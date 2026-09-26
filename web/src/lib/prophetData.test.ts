import { describe, expect, test } from "bun:test";
import { MOCK_PARENT_NAME, MOCK_PROPHECIES, MOCK_PROPHETS } from "./mock";
import {
  canClaimCreatorFee,
  curveProgress,
  getProphecyByName,
  getProphetPage,
  isDeparted,
  isMockProphetRecord,
  normalizeProphetLabel,
  prophecyDetailPath,
  prophecyEnsName,
  prophecyTradeLabel,
  prophetEnsName,
  prophetPageFromChain,
  prototypeCoinFromName,
} from "./prophetData";

/** After the two departed mock deadlines, before the 2028 open one. */
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
    const byLabel = getProphetPage("ringo", NOW);
    const byName = getProphetPage("ringo.prophecy.eth", NOW);
    expect(byLabel).not.toBeNull();
    expect(byName).not.toBeNull();
    expect(byLabel?.prophet.ensName).toBe(prophetEnsName("ringo"));
    expect(byLabel?.prophet.wallet).toBe(MOCK_PROPHETS[0].wallet);
    expect(byName?.prophet.wallet).toBe(byLabel?.prophet.wallet);
  });

  test("lists slug.name.prophecy.eth children with sentences from the mock", () => {
    const page = getProphetPage("ringo", NOW);
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

  test("marks Departed from the deadline, not from graduation", () => {
    expect(isDeparted(1_700_000_000, NOW)).toBe(true);
    expect(isDeparted(1_830_297_600, NOW)).toBe(false);
    const page = getProphetPage("ringo", NOW)!;
    const departed = page.prophecies.filter((p) => p.departed);
    const open = page.prophecies.filter((p) => !p.departed);
    expect(page.departedCount).toBe(2);
    expect(departed.map((p) => p.slug).sort()).toEqual(["last-talk", "two-min"]);
    expect(open.map((p) => p.slug).sort()).toEqual(["badges-2028", "curve-out", "sold-out"]);
    const graduated = page.prophecies.filter((p) => p.complete).map((p) => p.slug).sort();
    expect(graduated).toEqual(["sold-out", "two-min"]);
    expect(page.prophecies.find((p) => p.slug === "two-min")!.departed).toBe(true);
    expect(page.prophecies.find((p) => p.slug === "sold-out")!.departed).toBe(false);
    expect(page.prophecies.find((p) => p.slug === "sold-out")!.curveProgress).toBe(1);
  });

  test("returns null for an unknown prophet", () => {
    expect(getProphetPage("nobody", NOW)).toBeNull();
  });

  test("keeps mina separate from ringo", () => {
    const mina = getProphetPage("mina", NOW)!;
    expect(mina.prophecies).toHaveLength(1);
    expect(mina.prophecies[0].ensName).toBe("name-points.mina.prophecy.eth");
    expect(mina.claimableFeeWei).toBe(0n);
  });
});

describe("chain vs mock prophet claim", () => {
  test("mock rows hide claim in chain mode; a live own page still claims", () => {
    const mock = getProphetPage("ringo", NOW)!;
    expect(isMockProphetRecord(mock)).toBe(true);
    expect(canClaimCreatorFee(mock, { chain: true })).toBe(false);
    expect(canClaimCreatorFee(mock, { chain: false })).toBe(true);

    const own = prophetPageFromChain({
      label: "alice",
      wallet: "0x3333333333333333333333333333333333333333",
      claimableFeeWei: 1n,
    });
    expect(own.fromChain).toBe(true);
    expect(isMockProphetRecord(own)).toBe(false);
    expect(canClaimCreatorFee(own, { chain: true })).toBe(true);
    expect(canClaimCreatorFee(mock, { chain: true, claimFee: async () => undefined })).toBe(true);
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

describe("prophecyTradeLabel", () => {
  test("open rows buy; departed rows sell", () => {
    const page = getProphetPage("ringo", NOW)!;
    for (const row of page.prophecies) {
      expect(prophecyTradeLabel(row)).toBe(row.departed ? "Sell" : "Buy");
    }
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
    const byEns = getProphecyByName("badges-2028.ringo.prophecy.eth", NOW);
    const bySlug = getProphecyByName("badges-2028", NOW);
    expect(byEns?.sentence).toBe("Every hackathon badge is an ENS name by 2028");
    expect(byEns?.ensName).toBe("badges-2028.ringo.prophecy.eth");
    expect(bySlug?.ensName).toBe(byEns?.ensName);
    expect(getProphecyByName("missing.ringo.prophecy.eth", NOW)).toBeNull();
  });

  test("maps that name onto the prototype Screen 3 coin shape", () => {
    const coin = prototypeCoinFromName("badges-2028.ringo.prophecy.eth", NOW);
    expect(coin).not.toBeNull();
    expect(coin!.prophecy).toBe("Every hackathon badge is an ENS name by 2028");
    expect(coin!.name).toBe("badges-2028.ringo.prophecy.eth");
    expect(coin!.ticker).toBe("BADGES-2028");
  });

  test("does not invent a prototype coin in chain mode", () => {
    expect(prototypeCoinFromName("badges-2028.ringo.prophecy.eth", NOW, { mock: false })).toBeNull();
  });
});

describe("ENS text records", () => {
  test("sentence and deadline come from getEnsText keys, not from Launched", async () => {
    const { mockEnsText, parseDeadlineText, ENS_TEXT_DEADLINE, ENS_TEXT_PROPHECY } = await import("./ens");
    const name = "last-talk.ringo.prophecy.eth";
    expect(mockEnsText(name, ENS_TEXT_PROPHECY)).toBe("The last hallway talk is standing room only");
    expect(parseDeadlineText(mockEnsText(name, ENS_TEXT_DEADLINE))).toBe(1_700_000_000);
    const row = getProphecyByName(name, NOW)!;
    expect(row.sentence).toBe(mockEnsText(name, ENS_TEXT_PROPHECY));
    expect(row.deadline).toBe(parseDeadlineText(mockEnsText(name, ENS_TEXT_DEADLINE)));
    expect(row.departed).toBe(true);
  });
});
