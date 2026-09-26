import { describe, expect, it } from "vitest";
import { normalize } from "viem/ens";
import {
  ENS_TEXT_DEADLINE,
  ENS_TEXT_PROPHECY,
  ensTextQuery,
  getEnsAddress,
  getEnsDeadline,
  getEnsText,
  mockEnsAddress,
  mockEnsText,
  parseDeadlineText,
  prophecyMockName,
} from "./ens";
import { MOCK_PROPHECIES, MOCK_PROPHETS } from "./mock";

const ENS = "badges-2028.ringo.prophecy.eth";
const RESOLVER = "0x5d25c1d6acbb71b7a28aa7899618a3412a8303e3" as const;

describe("mock ENS text (INTERFACE §4)", () => {
  it("reads prophecy and deadline from mock.ts and not from Launched", () => {
    const row = MOCK_PROPHECIES[0];
    const name = prophecyMockName(row.slug, row.prophetLabel);
    expect(name).toBe(ENS);
    expect(mockEnsText(name, ENS_TEXT_PROPHECY)).toBe(row.sentence);
    expect(mockEnsText(name, ENS_TEXT_DEADLINE)).toBe(String(row.deadline));
    expect(mockEnsText(row.slug, ENS_TEXT_DEADLINE)).toBe(String(row.deadline));
    expect(mockEnsAddress(name)).toBe(row.token);
    expect(mockEnsAddress("ringo.prophecy.eth")).toBe(MOCK_PROPHETS[0].wallet);
  });

  it("parses deadline as unix seconds", () => {
    expect(parseDeadlineText("1830297600")).toBe(1_830_297_600);
    expect(parseDeadlineText("0")).toBeNull();
    expect(parseDeadlineText("soon")).toBeNull();
    expect(parseDeadlineText("")).toBeNull();
  });

  it("getEnsText uses the mock path when no Universal Resolver is set", async () => {
    await expect(getEnsText(ENS, ENS_TEXT_DEADLINE)).resolves.toBe("1830297600");
    await expect(getEnsDeadline(ENS)).resolves.toBe(1_830_297_600);
    await expect(getEnsAddress(ENS)).resolves.toBe(MOCK_PROPHECIES[0].token);
  });
});

describe("live Sepolia ENS text", () => {
  it("calls viem getEnsText with the Universal Resolver and deadline key", async () => {
    const seen: unknown[] = [];
    const client = {
      async getEnsText(args: unknown) {
        seen.push(args);
        return "1830297600";
      },
      async getEnsAddress() {
        return MOCK_PROPHECIES[0].token;
      },
    };
    const deadline = await getEnsDeadline(ENS, { client, universalResolver: RESOLVER });
    expect(deadline).toBe(1_830_297_600);
    expect(seen).toEqual([
      {
        name: normalize(ENS),
        key: "deadline",
        universalResolverAddress: RESOLVER,
      },
    ]);
  });

  it("builds wagmi useEnsText args for Sepolia", () => {
    const q = ensTextQuery(ENS, ENS_TEXT_DEADLINE);
    expect(q.key).toBe("deadline");
    expect(q.chainId).toBe(11_155_111);
    expect(q.query.enabled).toBe(false);
  });
});
