import { encodeAbiParameters, encodeEventTopics, parseEther, parseUnits } from "viem";
import { describe, expect, it, vi } from "vitest";
import { launchpadAbi } from "./launchpadAbi";
import { MOCK_PROPHECIES, MOCK_WORLD_LAUNCHPAD } from "./mock";
import { quoteBuyWei, toCurveWei } from "./curve";
import { actions } from "./store";
import { wagmiConfig } from "./wagmi";
import {
  applySlippage,
  buyWrite,
  claimCreatorFeeWrite,
  createBuy,
  createClaim,
  createLaunch,
  createSell,
  ethInputToWei,
  isChainWriteTarget,
  isFirstBuyTooSmall,
  isMockCoinRecord,
  isMockTokenAddress,
  launchWrite,
  LaunchedParseError,
  liveTokenAddress,
  minEthOutForSell,
  minOutAfterSlippage,
  minTokensOutForBuy,
  sellWrite,
  tokenFromLaunchedReceipt,
  tradeDeadlineUnix,
  TransactionRevertedError,
  TX_DEADLINE_SECONDS,
  WRITE_COPY,
  ZERO_QUOTE_COPY,
  ZeroQuoteError,
  type LaunchInput,
  type WriteOptions,
  type WriteReceipt,
} from "./writes";

const TOKEN = "0x1111111111111111111111111111111111111111" as const;
const ACCOUNT = "0x2222222222222222222222222222222222222222" as const;
const HASH = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

const launchInput: LaunchInput = {
  slug: "lingo-2028",
  prophecy: "Every badge is a name",
  deadline: 1_830_297_600n,
  firstBuyWei: parseEther("0.001"),
};

function launchedReceipt(token = TOKEN): WriteReceipt {
  const topics = encodeEventTopics({
    abi: launchpadAbi,
    eventName: "Launched",
    args: { token, prophet: ACCOUNT },
  });
  const data = encodeAbiParameters(
    [
      { name: "prophetLabel", type: "string" },
      { name: "slug", type: "string" },
    ],
    ["ringo", "lingo-2028"],
  );
  return {
    status: "success",
    logs: [
      {
        address: MOCK_WORLD_LAUNCHPAD,
        topics: topics as unknown as string[],
        data,
      },
    ],
  };
}

function mocks(overrides: Partial<WriteOptions> = {}): WriteOptions & {
  simulateContract: ReturnType<typeof vi.fn>;
  writeContract: ReturnType<typeof vi.fn>;
  waitForTransactionReceipt: ReturnType<typeof vi.fn>;
  readContract: ReturnType<typeof vi.fn>;
} {
  const simulateContract = vi.fn(async (_c, request) => ({ request, result: undefined }));
  const writeContract = vi.fn(async () => HASH);
  const waitForTransactionReceipt = vi.fn(async () => ({ status: "success", logs: [] }));
  const readContract = vi.fn(async (...args: unknown[]) => {
    const request = (args[1] ?? args[0]) as { functionName?: string };
    if (request.functionName === "allowance") return 0n;
    if (request.functionName === "quoteBuy") return [100_000n, 1n] as const;
    if (request.functionName === "quoteSell") return [50_000n, 1n] as const;
    if (request.functionName === "curve") return [0n, 0n, 0n, 0n, false] as const;
    if (request.functionName === "balanceOf") return 0n;
    return 0n;
  });
  return {
    address: MOCK_WORLD_LAUNCHPAD,
    simulateContract,
    writeContract,
    waitForTransactionReceipt,
    readContract,
    getAccount: () => ({ address: ACCOUNT }),
    getBalance: async () => parseEther("1"),
    ...overrides,
  };
}

describe("slippage and deadline helpers", () => {
  it("applies a 1% band that stays non-zero for a positive quote", () => {
    expect(applySlippage(10_000n)).toBe(9_900n);
    expect(minOutAfterSlippage(10_000n)).toBe(9_900n);
    expect(minOutAfterSlippage(10_000n)).toBeGreaterThan(0n);
    expect(minOutAfterSlippage(1n)).toBe(1n);
    expect(minTokensOutForBuy(0n)).toBe(0n);
    const ethIn = parseEther("0.001");
    const raw = quoteBuyWei(toCurveWei({ sold: 0, ethRaised: 0 }), ethIn).tokensOut;
    expect(minTokensOutForBuy(ethIn)).toBe(minOutAfterSlippage(raw));
    expect(minTokensOutForBuy(ethIn)).toBeGreaterThan(0n);
    expect(minTokensOutForBuy(ethIn)).toBeLessThan(raw);
    const now = Date.parse("2026-09-26T00:00:00Z");
    expect(tradeDeadlineUnix(now)).toBe(BigInt(Math.floor(now / 1000) + TX_DEADLINE_SECONDS));
    expect(TX_DEADLINE_SECONDS).toBe(600);
    expect(ethInputToWei("0")).toBe(0n);
    expect(ethInputToWei("0.001")).toBe(parseEther("0.001"));
    expect(liveTokenAddress("wifi")).toBeUndefined();
    expect(liveTokenAddress(TOKEN)).toBe(TOKEN);
    expect(isMockCoinRecord({ id: "wifi" })).toBe(true);
    expect(isMockTokenAddress(MOCK_PROPHECIES[0]!.token)).toBe(true);
    expect(isChainWriteTarget({ id: "wifi" })).toBe(false);
    expect(isChainWriteTarget({ id: "wifi", token: MOCK_PROPHECIES[0]!.token })).toBe(false);
    expect(isChainWriteTarget({ id: TOKEN, token: TOKEN })).toBe(true);
    expect(isChainWriteTarget({ id: TOKEN, token: TOKEN, fromChain: true })).toBe(true);
    expect(isChainWriteTarget({ id: MOCK_PROPHECIES[0]!.token, token: MOCK_PROPHECIES[0]!.token })).toBe(false);
    expect(
      isChainWriteTarget({ id: MOCK_PROPHECIES[0]!.token, token: MOCK_PROPHECIES[0]!.token, fromChain: true }),
    ).toBe(true);
  });

  it("keeps designer write copy free of flagged wording", () => {
    const text = Object.values(WRITE_COPY).join(" ").toLowerCase();
    expect(text).not.toMatch(/coin|profit|yield|prediction|true|false|%/);
    expect(WRITE_COPY.pending).toBe("Confirm in your wallet.");
    expect(WRITE_COPY.waiting).toBe("Waiting for Sepolia…");
    expect(WRITE_COPY.launchSuccess).toBe("Token is live.");
    expect(WRITE_COPY.tradeSuccess).toBe("Trade confirmed.");
    expect(WRITE_COPY.claimSuccess).toBe("Fees claimed.");
    expect(WRITE_COPY.failed).toBe("Transaction failed. Nothing was charged except gas. Try again.");
    expect(WRITE_COPY.launchedMissing).toBe(
      "Token launched, but we couldn't find its page. Check your wallet activity.",
    );
    expect(WRITE_COPY.approve).toBe("Approve tokens to sell");
    expect(ZERO_QUOTE_COPY).toBe("Amount too small to trade. Try a larger amount.");
    expect(Object.values(WRITE_COPY)).not.toContain(ZERO_QUOTE_COPY);
  });
});

describe("launch write", () => {
  it("simulate → write → receipt, then reads the token from Launched", async () => {
    const fns = mocks({
      waitForTransactionReceipt: vi.fn(async () => launchedReceipt()),
    });
    const run = createLaunch(fns);
    const token = await run(launchInput);
    expect(token).toBe(TOKEN);
    expect(fns.simulateContract).toHaveBeenCalledTimes(1);
    expect(fns.writeContract).toHaveBeenCalledTimes(1);
    expect(fns.waitForTransactionReceipt).toHaveBeenCalledTimes(1);
    const request = launchWrite(launchInput, MOCK_WORLD_LAUNCHPAD);
    expect(fns.simulateContract.mock.calls[0][0]).toBe(wagmiConfig);
    expect(fns.simulateContract.mock.calls[0][1]).toMatchObject({
      address: MOCK_WORLD_LAUNCHPAD,
      functionName: "launch",
      args: [launchInput.slug, launchInput.prophecy, launchInput.deadline, request.args[3]],
      value: launchInput.firstBuyWei,
    });
    expect(fns.writeContract.mock.calls[0][1]).toMatchObject({ functionName: "launch" });
    expect(tokenFromLaunchedReceipt(launchedReceipt())).toBe(TOKEN);
  });

  it("throws LaunchedParseError when Launched is missing after a successful receipt", async () => {
    const fns = mocks({
      waitForTransactionReceipt: vi.fn(async () => ({ status: "success", logs: [] })),
    });
    await expect(createLaunch(fns)(launchInput)).rejects.toBeInstanceOf(LaunchedParseError);
    expect(fns.writeContract).toHaveBeenCalledTimes(1);
  });

  it("throws on a reverted receipt", async () => {
    const fns = mocks({
      waitForTransactionReceipt: vi.fn(async () => ({ status: "reverted", logs: [] })),
    });
    await expect(createLaunch(fns)(launchInput)).rejects.toBeInstanceOf(TransactionRevertedError);
  });

  it("does not send when simulation fails", async () => {
    const fns = mocks({
      simulateContract: vi.fn(async () => {
        throw new Error("Slippage");
      }),
    });
    await expect(createLaunch(fns)(launchInput)).rejects.toThrow(/Slippage/);
    expect(fns.writeContract).not.toHaveBeenCalled();
    expect(fns.waitForTransactionReceipt).not.toHaveBeenCalled();
  });

  it("is a no-op when the launchpad address is unset", async () => {
    const fns = mocks({ address: undefined });
    const token = await createLaunch(fns)(launchInput);
    expect(token).toBeNull();
    expect(fns.simulateContract).not.toHaveBeenCalled();
    expect(fns.writeContract).not.toHaveBeenCalled();
  });

  it("refuses a first buy whose quote is 0 before simulate or write", async () => {
    const fns = mocks();
    const tiny = { ...launchInput, firstBuyWei: 1n };
    expect(isFirstBuyTooSmall(tiny.firstBuyWei)).toBe(true);
    expect(minTokensOutForBuy(tiny.firstBuyWei)).toBe(0n);
    await expect(createLaunch(fns)(tiny)).rejects.toBeInstanceOf(ZeroQuoteError);
    await expect(createLaunch(fns)(tiny)).rejects.toThrow(ZERO_QUOTE_COPY);
    expect(fns.simulateContract).not.toHaveBeenCalled();
    expect(fns.writeContract).not.toHaveBeenCalled();
  });

  it("still launches when first buy is 0 ETH (no first-buy minOut)", async () => {
    const fns = mocks({
      waitForTransactionReceipt: vi.fn(async () => launchedReceipt()),
    });
    const none = { ...launchInput, firstBuyWei: 0n };
    expect(isFirstBuyTooSmall(none.firstBuyWei)).toBe(false);
    expect(minTokensOutForBuy(none.firstBuyWei)).toBe(0n);
    expect(await createLaunch(fns)(none)).toBe(TOKEN);
    expect(fns.simulateContract).toHaveBeenCalledTimes(1);
    expect(fns.writeContract).toHaveBeenCalledTimes(1);
    expect(fns.simulateContract.mock.calls[0][1]).toMatchObject({
      functionName: "launch",
      args: [none.slug, none.prophecy, none.deadline, 0n],
      value: 0n,
    });
  });
});

describe("buy write", () => {
  const input = {
    token: TOKEN,
    ethIn: parseEther("0.001"),
    memo: "",
    curve: { sold: 0, ethRaised: 0 },
  };

  it("simulate → write → success receipt", async () => {
    const fns = mocks();
    expect(await createBuy(fns)(input)).toBe(true);
    expect(fns.simulateContract).toHaveBeenCalledTimes(1);
    expect(fns.writeContract).toHaveBeenCalledTimes(1);
    expect(fns.waitForTransactionReceipt).toHaveBeenCalledWith(wagmiConfig, { hash: HASH });
    const minTokensOut = minOutAfterSlippage(100_000n);
    expect(minTokensOut).toBeGreaterThan(0n);
    const request = buyWrite(input, MOCK_WORLD_LAUNCHPAD, minTokensOut);
    expect(fns.simulateContract.mock.calls[0][1]).toMatchObject({
      functionName: "buy",
      args: request.args,
      value: input.ethIn,
    });
    expect(
      fns.readContract.mock.calls.some((call) => {
        const req = (call[1] ?? call[0]) as { functionName?: string };
        return req.functionName === "quoteBuy";
      }),
    ).toBe(true);
  });

  it("throws on a reverted receipt", async () => {
    const fns = mocks({
      waitForTransactionReceipt: vi.fn(async () => ({ status: "reverted" })),
    });
    await expect(createBuy(fns)(input)).rejects.toBeInstanceOf(TransactionRevertedError);
  });

  it("does not send when simulation fails", async () => {
    const fns = mocks({
      simulateContract: vi.fn(async () => {
        throw new Error("CurveComplete");
      }),
    });
    await expect(createBuy(fns)(input)).rejects.toThrow(/CurveComplete/);
    expect(fns.writeContract).not.toHaveBeenCalled();
  });

  it("is a no-op when the launchpad address is unset", async () => {
    const fns = mocks({ address: undefined });
    expect(await createBuy(fns)(input)).toBe(false);
    expect(fns.simulateContract).not.toHaveBeenCalled();
    expect(fns.writeContract).not.toHaveBeenCalled();
  });

  it("does not simulate or write a mock token address", async () => {
    const fns = mocks();
    expect(await createBuy(fns)({ ...input, token: MOCK_PROPHECIES[0]!.token })).toBe(false);
    expect(fns.simulateContract).not.toHaveBeenCalled();
    expect(fns.writeContract).not.toHaveBeenCalled();
    expect(fns.readContract).not.toHaveBeenCalled();
  });

  it("refuses a 0 quoteBuy before simulate or write", async () => {
    const fns = mocks({
      readContract: vi.fn(async (...args: unknown[]) => {
        const request = (args[1] ?? args[0]) as { functionName?: string };
        if (request.functionName === "quoteBuy") return [0n, 0n] as const;
        return 0n;
      }),
    });
    await expect(createBuy(fns)(input)).rejects.toBeInstanceOf(ZeroQuoteError);
    await expect(createBuy(fns)({ ...input, ethIn: 1n })).rejects.toThrow(ZERO_QUOTE_COPY);
    expect(fns.simulateContract).not.toHaveBeenCalled();
    expect(fns.writeContract).not.toHaveBeenCalled();
  });
});

describe("sell write", () => {
  const curve = { sold: 1_000_000, ethRaised: 0.001 };
  const input = {
    token: TOKEN,
    tokensIn: parseUnits("1000", 18),
    memo: "",
    curve,
    account: ACCOUNT,
  };

  it("approves when allowance is short, then sells", async () => {
    const fns = mocks({
      readContract: vi.fn(async (...args: unknown[]) => {
        const request = (args[1] ?? args[0]) as { functionName?: string };
        if (request.functionName === "allowance") return 0n;
        if (request.functionName === "quoteSell") return [50_000n, 1n] as const;
        return 0n;
      }),
    });
    expect(await createSell(fns)(input)).toBe(true);
    expect(fns.simulateContract).toHaveBeenCalledTimes(2);
    expect(fns.writeContract).toHaveBeenCalledTimes(2);
    expect(fns.simulateContract.mock.calls[0][1]).toMatchObject({
      functionName: "approve",
      args: [MOCK_WORLD_LAUNCHPAD, input.tokensIn],
    });
    const minEthOut = minOutAfterSlippage(50_000n);
    expect(minEthOut).toBeGreaterThan(0n);
    expect(fns.simulateContract.mock.calls[1][1]).toMatchObject({
      functionName: "sell",
      args: sellWrite(input, MOCK_WORLD_LAUNCHPAD, minEthOut).args,
    });
    expect(minEthOutForSell(input.tokensIn, curve)).toBeGreaterThan(0n);
    expect(fns.waitForTransactionReceipt).toHaveBeenCalledTimes(2);
    expect(fns.simulateContract.mock.calls[0][0]).toBe(wagmiConfig);
    expect(fns.writeContract.mock.calls[0][0]).toBe(wagmiConfig);
    expect(fns.waitForTransactionReceipt.mock.calls[0][0]).toBe(wagmiConfig);
  });

  it("does not write approve or simulate sell when approve simulate throws", async () => {
    const fns = mocks({
      readContract: vi.fn(async (...args: unknown[]) => {
        const request = (args[1] ?? args[0]) as { functionName?: string };
        if (request.functionName === "allowance") return 0n;
        if (request.functionName === "quoteSell") return [50_000n, 1n] as const;
        return 0n;
      }),
      simulateContract: vi.fn(async (_c, request: { functionName?: string }) => {
        if (request.functionName === "approve") throw new Error("ApproveRevert");
        return { request, result: undefined };
      }),
    });
    await expect(createSell(fns)(input)).rejects.toThrow(/ApproveRevert/);
    expect(fns.simulateContract).toHaveBeenCalledTimes(1);
    expect(fns.simulateContract.mock.calls[0][1]).toMatchObject({ functionName: "approve" });
    expect(fns.writeContract).not.toHaveBeenCalled();
    expect(fns.waitForTransactionReceipt).not.toHaveBeenCalled();
    expect(
      fns.simulateContract.mock.calls.some((call) => {
        const req = call[1] as { functionName?: string };
        return req.functionName === "sell";
      }),
    ).toBe(false);
  });

  it("throws when the approve receipt reverts and never simulates or sends sell", async () => {
    const fns = mocks({
      readContract: vi.fn(async (...args: unknown[]) => {
        const request = (args[1] ?? args[0]) as { functionName?: string };
        if (request.functionName === "allowance") return 0n;
        if (request.functionName === "quoteSell") return [50_000n, 1n] as const;
        return 0n;
      }),
      waitForTransactionReceipt: vi.fn(async () => ({ status: "reverted" })),
    });
    await expect(createSell(fns)(input)).rejects.toBeInstanceOf(TransactionRevertedError);
    expect(fns.simulateContract).toHaveBeenCalledTimes(1);
    expect(fns.simulateContract.mock.calls[0][1]).toMatchObject({ functionName: "approve" });
    expect(fns.writeContract).toHaveBeenCalledTimes(1);
    expect(fns.writeContract.mock.calls[0][1]).toMatchObject({ functionName: "approve" });
    expect(fns.waitForTransactionReceipt).toHaveBeenCalledTimes(1);
    expect(
      fns.simulateContract.mock.calls.some((call) => {
        const req = call[1] as { functionName?: string };
        return req.functionName === "sell";
      }),
    ).toBe(false);
    expect(
      fns.writeContract.mock.calls.some((call) => {
        const req = call[1] as { functionName?: string };
        return req.functionName === "sell";
      }),
    ).toBe(false);
  });

  it("skips approve when allowance already covers the sell", async () => {
    const fns = mocks({
      readContract: vi.fn(async (...args: unknown[]) => {
        const request = (args[1] ?? args[0]) as { functionName?: string };
        if (request.functionName === "allowance") return input.tokensIn;
        if (request.functionName === "quoteSell") return [50_000n, 1n] as const;
        return 0n;
      }),
    });
    expect(await createSell(fns)(input)).toBe(true);
    expect(fns.simulateContract).toHaveBeenCalledTimes(1);
    expect(fns.simulateContract.mock.calls[0][1]).toMatchObject({ functionName: "sell" });
  });

  it("throws on a reverted sell receipt", async () => {
    const fns = mocks({
      readContract: vi.fn(async (...args: unknown[]) => {
        const request = (args[1] ?? args[0]) as { functionName?: string };
        if (request.functionName === "allowance") return input.tokensIn;
        if (request.functionName === "quoteSell") return [50_000n, 1n] as const;
        return 0n;
      }),
      waitForTransactionReceipt: vi.fn(async () => ({ status: "reverted" })),
    });
    await expect(createSell(fns)(input)).rejects.toBeInstanceOf(TransactionRevertedError);
  });

  it("does not send sell when simulation fails", async () => {
    const fns = mocks({
      readContract: vi.fn(async (...args: unknown[]) => {
        const request = (args[1] ?? args[0]) as { functionName?: string };
        if (request.functionName === "allowance") return input.tokensIn;
        if (request.functionName === "quoteSell") return [50_000n, 1n] as const;
        return 0n;
      }),
      simulateContract: vi.fn(async () => {
        throw new Error("ExceedsSold");
      }),
    });
    await expect(createSell(fns)(input)).rejects.toThrow(/ExceedsSold/);
    expect(fns.writeContract).not.toHaveBeenCalled();
  });

  it("is a no-op when the launchpad address is unset", async () => {
    const fns = mocks({ address: undefined });
    expect(await createSell(fns)(input)).toBe(false);
    expect(fns.simulateContract).not.toHaveBeenCalled();
    expect(fns.writeContract).not.toHaveBeenCalled();
    expect(fns.readContract).not.toHaveBeenCalled();
  });

  it("does not approve, simulate, or write a mock token address", async () => {
    const fns = mocks();
    expect(await createSell(fns)({ ...input, token: MOCK_PROPHECIES[0]!.token })).toBe(false);
    expect(fns.simulateContract).not.toHaveBeenCalled();
    expect(fns.writeContract).not.toHaveBeenCalled();
    expect(fns.readContract).not.toHaveBeenCalled();
  });

  it("refuses a 0 quoteSell before approve, simulate, or write", async () => {
    const fns = mocks({
      readContract: vi.fn(async (...args: unknown[]) => {
        const request = (args[1] ?? args[0]) as { functionName?: string };
        if (request.functionName === "quoteSell") return [0n, 0n] as const;
        if (request.functionName === "allowance") return 0n;
        return 0n;
      }),
    });
    await expect(createSell(fns)(input)).rejects.toBeInstanceOf(ZeroQuoteError);
    await expect(createSell(fns)(input)).rejects.toThrow(ZERO_QUOTE_COPY);
    expect(fns.simulateContract).not.toHaveBeenCalled();
    expect(fns.writeContract).not.toHaveBeenCalled();
    expect(
      fns.readContract.mock.calls.some((call) => {
        const req = (call[1] ?? call[0]) as { functionName?: string };
        return req.functionName === "allowance";
      }),
    ).toBe(false);
  });
});

describe("claimCreatorFee write", () => {
  it("simulate → write → success receipt", async () => {
    const fns = mocks();
    expect(await createClaim(fns)()).toBe(true);
    expect(fns.simulateContract.mock.calls[0][1]).toMatchObject(claimCreatorFeeWrite(MOCK_WORLD_LAUNCHPAD));
    expect(fns.writeContract).toHaveBeenCalledTimes(1);
  });

  it("throws on a reverted receipt", async () => {
    const fns = mocks({
      waitForTransactionReceipt: vi.fn(async () => ({ status: "reverted" })),
    });
    await expect(createClaim(fns)()).rejects.toBeInstanceOf(TransactionRevertedError);
  });

  it("does not send when simulation fails", async () => {
    const fns = mocks({
      simulateContract: vi.fn(async () => {
        throw new Error("ZeroAmount");
      }),
    });
    await expect(createClaim(fns)()).rejects.toThrow(/ZeroAmount/);
    expect(fns.writeContract).not.toHaveBeenCalled();
  });

  it("is a no-op when the launchpad address is unset", async () => {
    const fns = mocks({ address: undefined });
    expect(await createClaim(fns)()).toBe(false);
    expect(fns.simulateContract).not.toHaveBeenCalled();
    expect(fns.writeContract).not.toHaveBeenCalled();
  });
});

describe("mock store path", () => {
  it("create / buy / sell still update the local store when writes no-op", async () => {
    const fns = mocks({ address: undefined });
    expect(await createLaunch(fns)(launchInput)).toBeNull();
    expect(await createBuy(fns)({ token: TOKEN, ethIn: 1n })).toBe(false);
    expect(await createSell(fns)({ token: TOKEN, tokensIn: 1n, account: ACCOUNT })).toBe(false);
    expect(await createClaim(fns)()).toBe(false);

    actions.reset();
    const id = actions.create({
      name: "mock-slug",
      ticker: "MOCK",
      prophecy: "A local-only prophecy",
      firstBuy: 0.001,
    });
    expect(id).toMatch(/^[a-z0-9]{8}$/);
    actions.buy(id, 0.001);
    actions.sell(id, 1);
  });
});
