import { formatEther, formatUnits, isAddress, parseEventLogs, parseEther, type Address, type Hex } from "viem";
import {
  getAccount,
  getBalance,
  readContract,
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
} from "wagmi/actions";
import { quoteBuyWei, quoteSellWei, toCurveWei, type CurveState } from "./curve";
import { contracts } from "./contracts";
import { erc20Abi } from "./erc20Abi";
import { launchpadAbi } from "./launchpadAbi";
import { actions } from "./store";
import { wagmiConfig } from "./wagmi";

/** 1% band under the local curve quote. */
export const SLIPPAGE_BPS = 100n;
export const BPS_DENOM = 10_000n;

/** Unix seconds added to now. buy/sell have no deadline arg; launch uses the form deadline. */
export const TX_DEADLINE_SECONDS = 10 * 60;

export const WRITE_COPY = {
  pending: "Confirm in your wallet.",
  failed: "The transaction did not go through. Please try again.",
} as const;

export class TransactionRevertedError extends Error {
  constructor() {
    super("Transaction failed");
    this.name = "TransactionRevertedError";
  }
}

export type WriteReceipt = {
  status?: string;
  logs?: readonly { address?: string; topics?: readonly string[]; data?: string }[];
};

export type SimulateFn = (
  config: typeof wagmiConfig,
  request: Record<string, unknown>,
) => Promise<{ request: Record<string, unknown>; result?: unknown }>;

export type WriteFn = (config: typeof wagmiConfig, request: Record<string, unknown>) => Promise<Hex>;

export type WaitFn = (
  config: typeof wagmiConfig,
  args: { hash: Hex },
) => Promise<WriteReceipt>;

export type ReadFn = (config: typeof wagmiConfig, request: Record<string, unknown>) => Promise<unknown>;

export type WriteOptions = {
  address?: Address | undefined;
  simulateContract?: SimulateFn;
  writeContract?: WriteFn;
  waitForTransactionReceipt?: WaitFn;
  readContract?: ReadFn;
  getAccount?: () => { address?: Address };
  getBalance?: (
    config: typeof wagmiConfig,
    args: { address: Address },
  ) => Promise<bigint | { value: bigint }>;
};

export type LaunchInput = {
  slug: string;
  prophecy: string;
  deadline: bigint;
  firstBuyWei: bigint;
};

export type BuyInput = {
  token: Address;
  ethIn: bigint;
  memo?: string;
  curve?: CurveState;
};

export type SellInput = {
  token: Address;
  tokensIn: bigint;
  memo?: string;
  curve?: CurveState;
  account?: Address;
};

export function applySlippage(quoted: bigint, bps = SLIPPAGE_BPS): bigint {
  if (quoted === 0n) return 0n;
  return (quoted * (BPS_DENOM - bps)) / BPS_DENOM;
}

export function tradeDeadlineUnix(nowMs = Date.now()): bigint {
  return BigInt(Math.floor(nowMs / 1000) + TX_DEADLINE_SECONDS);
}

export function ethInputToWei(value: string | number): bigint {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0n;
  return parseEther(n.toFixed(18));
}

export function minTokensOutForBuy(ethIn: bigint, curve: CurveState = { sold: 0, ethRaised: 0 }): bigint {
  if (ethIn === 0n) return 0n;
  return applySlippage(quoteBuyWei(toCurveWei(curve), ethIn).tokensOut);
}

export function minEthOutForSell(tokensIn: bigint, curve: CurveState): bigint {
  if (tokensIn === 0n) return 0n;
  return applySlippage(quoteSellWei(toCurveWei(curve), tokensIn).ethPayout);
}

/** Only address-id coins (a just-launched token) go on chain. Mock ids stay local. */
export function liveTokenAddress(id: string, token?: string): Address | undefined {
  if (token && isAddress(token)) return token;
  if (isAddress(id)) return id;
  return undefined;
}

export function launchWrite(input: LaunchInput, address: Address) {
  const minTokensOut = minTokensOutForBuy(input.firstBuyWei);
  return {
    address,
    abi: launchpadAbi,
    functionName: "launch" as const,
    args: [input.slug, input.prophecy, input.deadline, minTokensOut] as const,
    value: input.firstBuyWei,
  };
}

export function buyWrite(input: BuyInput, address: Address) {
  return {
    address,
    abi: launchpadAbi,
    functionName: "buy" as const,
    args: [input.token, minTokensOutForBuy(input.ethIn, input.curve), input.memo ?? ""] as const,
    value: input.ethIn,
  };
}

export function sellWrite(input: SellInput, address: Address) {
  return {
    address,
    abi: launchpadAbi,
    functionName: "sell" as const,
    args: [
      input.token,
      input.tokensIn,
      minEthOutForSell(input.tokensIn, input.curve ?? { sold: 0, ethRaised: 0 }),
      input.memo ?? "",
    ] as const,
  };
}

export function claimCreatorFeeWrite(address: Address) {
  return {
    address,
    abi: launchpadAbi,
    functionName: "claimCreatorFee" as const,
    args: [] as const,
  };
}

export function approveWrite(token: Address, spender: Address, amount: bigint) {
  return {
    address: token,
    abi: erc20Abi,
    functionName: "approve" as const,
    args: [spender, amount] as const,
  };
}

export function tokenFromLaunchedReceipt(receipt: WriteReceipt): Address {
  const parsed = parseEventLogs({
    abi: launchpadAbi,
    eventName: "Launched",
    logs: (receipt.logs ?? []) as never,
  });
  const token = parsed[0]?.args?.token;
  if (!token) throw new Error("Launched event missing");
  return token;
}

function resolveAddress(options: WriteOptions): Address | undefined {
  return "address" in options ? options.address : contracts.launchpad;
}

function clients(options: WriteOptions) {
  return {
    simulate: options.simulateContract ?? (simulateContract as unknown as SimulateFn),
    write: options.writeContract ?? (writeContract as unknown as WriteFn),
    wait: options.waitForTransactionReceipt ?? (waitForTransactionReceipt as unknown as WaitFn),
    read: options.readContract ?? (readContract as unknown as ReadFn),
    accountOf: options.getAccount ?? (() => getAccount(wagmiConfig)),
    balanceOf: options.getBalance ?? getBalance,
  };
}

async function sendWrite(
  request: Record<string, unknown>,
  options: WriteOptions,
): Promise<WriteReceipt> {
  const { simulate, write, wait } = clients(options);
  const simulated = await simulate(wagmiConfig, request);
  const hash = await write(wagmiConfig, simulated.request);
  const receipt = await wait(wagmiConfig, { hash });
  if (receipt.status !== "success") throw new TransactionRevertedError();
  return receipt;
}

export function createLaunch(
  options: WriteOptions = {},
): (input: LaunchInput) => Promise<Address | null> {
  const address = resolveAddress(options);
  return async (input) => {
    if (!address) return null;
    const receipt = await sendWrite(launchWrite(input, address) as unknown as Record<string, unknown>, options);
    return tokenFromLaunchedReceipt(receipt);
  };
}

export function createBuy(options: WriteOptions = {}): (input: BuyInput) => Promise<boolean> {
  const address = resolveAddress(options);
  return async (input) => {
    if (!address) return false;
    await sendWrite(buyWrite(input, address) as unknown as Record<string, unknown>, options);
    return true;
  };
}

export function createSell(options: WriteOptions = {}): (input: SellInput) => Promise<boolean> {
  const address = resolveAddress(options);
  return async (input) => {
    if (!address) return false;
    const { read, accountOf } = clients(options);
    const owner = input.account ?? accountOf().address;
    if (!owner) throw new Error("Connect a wallet");

    const allowance = (await read(wagmiConfig, {
      address: input.token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [owner, address],
    })) as bigint;

    if (allowance < input.tokensIn) {
      await sendWrite(approveWrite(input.token, address, input.tokensIn) as unknown as Record<string, unknown>, options);
    }

    await sendWrite(sellWrite(input, address) as unknown as Record<string, unknown>, options);
    return true;
  };
}

export function createClaim(options: WriteOptions = {}): () => Promise<boolean> {
  const address = resolveAddress(options);
  return async () => {
    if (!address) return false;
    await sendWrite(claimCreatorFeeWrite(address) as unknown as Record<string, unknown>, options);
    return true;
  };
}

export type ChainSnapshot = {
  sold: number;
  ethRaised: number;
  complete: boolean;
  balance: number;
  tokensHeld: number;
};

export async function readChainSnapshot(
  token: Address,
  options: WriteOptions = {},
): Promise<ChainSnapshot> {
  const address = resolveAddress(options);
  if (!address) {
    throw new Error("Launchpad address is not set");
  }
  const { read, accountOf, balanceOf } = clients(options);
  const owner = accountOf().address;
  if (!owner) throw new Error("Connect a wallet");

  const [curve, ethBal, tokenBal] = await Promise.all([
    read(wagmiConfig, {
      address,
      abi: launchpadAbi,
      functionName: "curve",
      args: [token],
    }) as Promise<readonly [bigint, bigint, bigint, bigint, boolean]>,
    balanceOf(wagmiConfig, { address: owner }).then((bal) =>
      typeof bal === "bigint" ? bal : bal.value,
    ),
    read(wagmiConfig, {
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner],
    }) as Promise<bigint>,
  ]);

  return {
    sold: Number(formatUnits(curve[3], 18)),
    ethRaised: Number(formatEther(curve[2])),
    complete: curve[4],
    balance: Number(formatEther(ethBal)),
    tokensHeld: Number(formatUnits(tokenBal, 18)),
  };
}

export async function refreshCoinFromChain(
  coinId: string,
  token: Address,
  options: WriteOptions = {},
): Promise<ChainSnapshot> {
  const snap = await readChainSnapshot(token, options);
  actions.applyChainSnapshot({
    coinId,
    sold: snap.sold,
    ethRaised: snap.ethRaised,
    balance: snap.balance,
    tokensHeld: snap.tokensHeld,
  });
  return snap;
}
