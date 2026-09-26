/**
 * Send a v4 swap from the app: quote, the Permit2 steps a sell needs, then
 * Universal Router `execute`. Mirrors `createBuy` / `createSell` in
 * `web/src/lib/writes.ts`, including the injectable wagmi actions tests use.
 */
import {
  getAccount,
  readContract,
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
} from "wagmi/actions";
import type { Address } from "viem";
import { wagmiConfig } from "../wagmi";
import { erc20Abi } from "../erc20Abi";
import { CCA_SEPOLIA } from "./addresses";
import { PERMIT2_MAX_AMOUNT, PERMIT2_MAX_EXPIRATION, permit2Abi } from "./abi/permit2";
import {
  minOutForSlippage,
  quoteExactInRequest,
  quoteFromSpotPrice,
  swapDeadline,
} from "./pool";
import { approvePermit2Write, permit2ApproveRouterWrite, swapExactInSingleWrite } from "./swap";

/** Same 1% default the curve trade box uses. */
export const SWAP_SLIPPAGE_BPS = 100n;

/** Permit2 allowances are given for 30 days, then re-confirmed (§7.10). */
export const PERMIT2_WINDOW_SECONDS = 60 * 60 * 24 * 30;

export type SwapPhase = "allow" | "confirm" | "wallet" | "waiting";

export type SwapInput = {
  token: Address;
  hooks: Address;
  /** true = ETH → token. */
  zeroForOne: boolean;
  amountIn: bigint;
  amountOutMinimum: bigint;
  onPhase?: (phase: SwapPhase) => void;
};

export type SwapOptions = {
  simulateContract?: typeof simulateContract;
  writeContract?: typeof writeContract;
  waitForTransactionReceipt?: typeof waitForTransactionReceipt;
  readContract?: typeof readContract;
  getAccount?: () => { address?: Address };
  nowSeconds?: () => number;
};

export class SwapWalletError extends Error {
  constructor() {
    super("Connect a wallet");
    this.name = "SwapWalletError";
  }
}

function clients(options: SwapOptions) {
  return {
    simulate: options.simulateContract ?? simulateContract,
    write: options.writeContract ?? writeContract,
    wait: options.waitForTransactionReceipt ?? waitForTransactionReceipt,
    read: options.readContract ?? readContract,
    accountOf: options.getAccount ?? (() => getAccount(wagmiConfig)),
    now: options.nowSeconds ?? (() => Date.now() / 1000),
  };
}

async function send(
  request: ReturnType<typeof swapExactInSingleWrite>,
  options: SwapOptions,
  phase: SwapPhase,
  input: SwapInput,
) {
  const { simulate, write, wait } = clients(options);
  input.onPhase?.(phase);
  const simulated = (await simulate(wagmiConfig, request as never)) as { request: unknown };
  const hash = await write(wagmiConfig, simulated.request as never);
  input.onPhase?.("waiting");
  const receipt = await wait(wagmiConfig, { hash });
  if (receipt.status !== "success") throw new Error("swap did not succeed");
  return receipt;
}

/**
 * Exact-out estimate for the amount the trader will receive.
 * The Quoter is authoritative; spot price is the fallback when it is
 * unreachable, and `amountOutMinimum` still protects the trade either way.
 */
export async function readSwapQuote(
  input: { token: Address; hooks: Address; zeroForOne: boolean; amountIn: bigint },
  sqrtPriceX96: bigint | undefined,
  options: SwapOptions = {},
): Promise<bigint> {
  if (input.amountIn <= 0n) return 0n;
  const { simulate } = clients(options);
  try {
    const simulated = (await simulate(wagmiConfig, quoteExactInRequest(input) as never)) as {
      result?: readonly bigint[] | bigint;
    };
    const result = simulated.result;
    const amountOut = Array.isArray(result) ? result[0] : (result as bigint | undefined);
    if (typeof amountOut === "bigint" && amountOut > 0n) return amountOut;
  } catch {
    // Quoter unreachable (no pool, no RPC). Fall through to spot.
  }
  if (!sqrtPriceX96) return 0n;
  return quoteFromSpotPrice(sqrtPriceX96, input.zeroForOne, input.amountIn);
}

export function minOutFromQuote(quoted: bigint, slippageBps = SWAP_SLIPPAGE_BPS): bigint {
  return minOutForSlippage(quoted, slippageBps);
}

/** Which of the two Permit2 steps a sell still needs. */
export async function readSellSteps(
  token: Address,
  amountIn: bigint,
  options: SwapOptions = {},
): Promise<{ needsAllow: boolean; needsConfirm: boolean; owner?: Address }> {
  const { read, accountOf, now } = clients(options);
  const owner = accountOf().address;
  if (!owner) return { needsAllow: true, needsConfirm: true };

  const allowance = (await read(wagmiConfig, {
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, CCA_SEPOLIA.permit2],
  } as never)) as bigint;

  const permit = (await read(wagmiConfig, {
    address: CCA_SEPOLIA.permit2,
    abi: permit2Abi,
    functionName: "allowance",
    args: [owner, token, CCA_SEPOLIA.universalRouter],
  } as never)) as readonly [bigint, number, number];

  const [permitAmount, expiration] = permit;
  const expired = BigInt(expiration) <= BigInt(Math.floor(now()));

  return {
    owner,
    needsAllow: allowance < amountIn,
    needsConfirm: permitAmount < amountIn || expired,
  };
}

/**
 * Returns false when there is nothing to send (no pool wiring), so the caller
 * can fall back the same way `createBuy` does.
 */
export function createSwap(options: SwapOptions = {}): (input: SwapInput) => Promise<boolean> {
  return async (input) => {
    if (input.amountIn <= 0n) return false;
    const { accountOf, now } = clients(options);

    if (!input.zeroForOne) {
      const owner = accountOf().address;
      if (!owner) throw new SwapWalletError();
      const steps = await readSellSteps(input.token, input.amountIn, options);
      if (steps.needsAllow) {
        await send(
          approvePermit2Write(input.token, PERMIT2_MAX_AMOUNT) as never,
          options,
          "allow",
          input,
        );
      }
      if (steps.needsConfirm) {
        const expiration = BigInt(Math.floor(now()) + PERMIT2_WINDOW_SECONDS);
        await send(
          permit2ApproveRouterWrite(
            input.token,
            PERMIT2_MAX_AMOUNT,
            expiration > PERMIT2_MAX_EXPIRATION ? PERMIT2_MAX_EXPIRATION : expiration,
          ) as never,
          options,
          "confirm",
          input,
        );
      }
    }

    await send(
      swapExactInSingleWrite({
        token: input.token,
        hooks: input.hooks,
        zeroForOne: input.zeroForOne,
        amountIn: input.amountIn,
        amountOutMinimum: input.amountOutMinimum,
        deadline: swapDeadline(now()),
      }),
      options,
      "wallet",
      input,
    );
    return true;
  };
}
