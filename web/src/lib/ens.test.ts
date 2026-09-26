import { describe, expect, it } from "vitest";
import { normalize } from "viem/ens";
import {
  ENS_TEXT_PROPHECY,
  ensTextQuery,
  getEnsAddress,
  getEnsText,
  mockEnsAddress,
  mockEnsText,
  prophecyMockName,
} from "./ens";
import { MOCK_PROPHECIES, MOCK_PROPHETS } from "./mock";

const ENS = "badges-2028.ringo.prophecy.eth";
const RESOLVER = "0x5d25c1d6acbb71b7a28aa7899618a3412a8303e3" as const;

describe("mock ENS text (INTERFACE §4)", () => {
  it("reads prophecy from mock.ts and not from Launched", () => {
    const row = MOCK_PROPHECIES[0];
    const name = prophecyMockName(row.slug, row.prophetLabel);
    expect(name).toBe(ENS);
    expect(mockEnsText(name, ENS_TEXT_PROPHECY)).toBe(row.sentence);
    expect(mockEnsText(row.slug, ENS_TEXT_PROPHECY)).toBe(row.sentence);
    expect(mockEnsText(name, "deadline")).toBeNull();
    expect(mockEnsAddress(name)).toBe(row.token);
    expect(mockEnsAddress("ringo.prophecy.eth")).toBe(MOCK_PROPHETS[0].wallet);
  });

  it("getEnsText uses the mock path when no Universal Resolver is set", async () => {
    await expect(getEnsText(ENS, ENS_TEXT_PROPHECY)).resolves.toBe(MOCK_PROPHECIES[0].sentence);
    await expect(getEnsAddress(ENS)).resolves.toBe(MOCK_PROPHECIES[0].token);
  });
});

describe("live Sepolia ENS text", () => {
  it("calls viem getEnsText with the Universal Resolver and prophecy key", async () => {
    const seen: unknown[] = [];
    const client = {
      async getEnsText(args: unknown) {
        seen.push(args);
        return MOCK_PROPHECIES[0].sentence;
      },
      async getEnsAddress() {
        return MOCK_PROPHECIES[0].token;
      },
    };
    const sentence = await getEnsText(ENS, ENS_TEXT_PROPHECY, { client, universalResolver: RESOLVER });
    expect(sentence).toBe(MOCK_PROPHECIES[0].sentence);
    expect(seen).toEqual([
      {
        name: normalize(ENS),
        key: "prophecy",
        universalResolverAddress: RESOLVER,
      },
    ]);
  });

  it("reads a found sentence once per client and keeps asking while it is missing", async () => {
    const answers: (string | null)[] = [null, MOCK_PROPHECIES[0].sentence];
    let calls = 0;
    const client = {
      async getEnsText() {
        calls += 1;
        return answers.shift() ?? null;
      },
      async getEnsAddress() {
        return null;
      },
    };
    const opts = { client, universalResolver: RESOLVER };
    await expect(getEnsText(ENS, ENS_TEXT_PROPHECY, opts)).resolves.toBeNull();
    await expect(getEnsText(ENS, ENS_TEXT_PROPHECY, opts)).resolves.toBe(MOCK_PROPHECIES[0].sentence);
    await expect(getEnsText(ENS, ENS_TEXT_PROPHECY, opts)).resolves.toBe(MOCK_PROPHECIES[0].sentence);
    expect(calls).toBe(2);
  });

  it("builds wagmi useEnsText args for Sepolia", () => {
    const q = ensTextQuery(ENS, ENS_TEXT_PROPHECY);
    expect(q.key).toBe("prophecy");
    expect(q.chainId).toBe(11_155_111);
    expect(q.query.enabled).toBe(false);
  });
});
