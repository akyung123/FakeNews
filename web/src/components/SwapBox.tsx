/**
 * In-app Uniswap v4 swap, INTERFACE_CCA §7.10.
 *
 * Exact-in only, straight to Universal Router 2.1.2 — the app does not send
 * the trader to Uniswap's own site once the market is open.
 */
import { useEffect, useState } from "react";
import { formatEther, parseEther, type Address } from "viem";
import { SWAP_SECTION_COPY, swapSectionCopy } from "../lib/cca/copy";
import { swapErrorCopyFor } from "../lib/cca/errors";
import {
  createSwap,
  minOutFromQuote,
  readSwapQuote,
  type SwapInput,
  type SwapPhase,
} from "../lib/cca/swapWrites";

export type SwapBoxProps = {
  token?: Address;
  hooks?: Address;
  symbol: string;
  /** False before `Migrated` / pool initialize: the section shows the gated line. */
  poolOpen: boolean;
  sqrtPriceX96?: bigint;
  ethBalanceWei?: bigint;
  tokenBalanceWei?: bigint;
  sendSwap?: (input: SwapInput) => Promise<boolean>;
  quote?: typeof readSwapQuote;
  /** Demo mode: quote from this ETH-per-token price instead of the chain. */
  demoPriceEth?: number;
  /** Called when nothing was sent, so the caller can fall back to the store. */
  onLocalTrade?: (trade: { zeroForOne: boolean; amountIn: bigint; quoted: bigint }) => void;
};

const PHASE_COPY: Record<SwapPhase, string> = {
  allow: SWAP_SECTION_COPY.allowing,
  confirm: SWAP_SECTION_COPY.confirming,
  wallet: "Confirm in your wallet.",
  waiting: "Waiting for Sepolia…",
};

function amountToWei(input: string): bigint {
  const value = Number(input);
  if (!Number.isFinite(value) || value <= 0) return 0n;
  try {
    return parseEther(value.toFixed(18));
  } catch {
    return 0n;
  }
}

/** Short, tabular figure. Not a percent: §0 forbids a percent price change. */
function show(wei: bigint): string {
  const value = Number(formatEther(wei));
  if (value === 0) return "0";
  if (value < 0.0001) return value.toExponential(2);
  if (value < 1) return value.toFixed(6);
  if (value < 1000) return value.toFixed(4);
  return Math.round(value).toLocaleString("en-US");
}

export function SwapBox({
  token,
  hooks,
  symbol,
  poolOpen,
  sqrtPriceX96,
  ethBalanceWei,
  tokenBalanceWei,
  sendSwap = createSwap(),
  quote = readSwapQuote,
  demoPriceEth,
  onLocalTrade,
}: SwapBoxProps) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("0.001");
  const [quoted, setQuoted] = useState(0n);
  const [pending, setPending] = useState(false);
  const [phase, setPhase] = useState<SwapPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /** The other side's quote is in the other currency, so drop it on a switch. */
  function pick(next: "buy" | "sell", startingAmount: string) {
    setSide(next);
    setAmount(startingAmount);
    setQuoted(0n);
    setSuccess(null);
    setError(null);
  }

  const zeroForOne = side === "buy";
  const amountIn = amountToWei(amount);
  const minOut = minOutFromQuote(quoted);
  const copy = swapSectionCopy({
    symbol,
    amount: show(quoted),
    minAmount: show(minOut),
  });

  useEffect(() => {
    if (!poolOpen || amountIn <= 0n) {
      setQuoted(0n);
      return;
    }
    if (demoPriceEth !== undefined) {
      // Same 1% pool fee the real quote pays, applied to a flat price.
      const afterFee = (amountIn * 99n) / 100n;
      const priceWei = parseEther(demoPriceEth.toFixed(18));
      setQuoted(
        priceWei <= 0n
          ? 0n
          : zeroForOne
            ? (afterFee * 10n ** 18n) / priceWei
            : (afterFee * priceWei) / 10n ** 18n,
      );
      return;
    }
    if (!token || !hooks) {
      setQuoted(0n);
      return;
    }
    let cancelled = false;
    void quote({ token, hooks, zeroForOne, amountIn }, sqrtPriceX96)
      .then((out) => {
        if (!cancelled) setQuoted(out);
      })
      .catch(() => {
        if (!cancelled) setQuoted(0n);
      });
    return () => {
      cancelled = true;
    };
  }, [poolOpen, token, hooks, zeroForOne, amountIn, sqrtPriceX96, quote, demoPriceEth]);

  if (!poolOpen) {
    return (
      <section className="block trade">
        <h2>{copy.title}</h2>
        <p className="faint">{copy.beforePoolOpen}</p>
      </section>
    );
  }

  const balance = zeroForOne ? ethBalanceWei : tokenBalanceWei;
  const shortOnFunds = balance !== undefined && amountIn > balance;
  const shortCopy = zeroForOne ? copy.notEnoughEth : copy.notEnoughToken;
  const canSend =
    (Boolean(token && hooks) || demoPriceEth !== undefined) &&
    amountIn > 0n &&
    !shortOnFunds &&
    !pending;

  function submit() {
    if (!canSend) return;
    void (async () => {
      setPending(true);
      setError(null);
      setSuccess(null);
      try {
        const sent = await sendSwap({
          token: token as Address,
          hooks: hooks as Address,
          zeroForOne,
          amountIn,
          amountOutMinimum: minOut,
          onPhase: setPhase,
        });
        if (!sent) onLocalTrade?.({ zeroForOne, amountIn, quoted });
        const done = swapSectionCopy({
          symbol,
          amount: show(zeroForOne ? quoted : amountIn),
        });
        setSuccess(zeroForOne ? done.bought : done.sold);
      } catch (err) {
        setError(swapErrorCopyFor(err, symbol));
      } finally {
        setPending(false);
        setPhase(null);
      }
    })();
  }

  return (
    <section className="block trade">
      <h2>{copy.title}</h2>

      <div className="tabs">
        <button
          type="button"
          className={side === "buy" ? "on buy" : ""}
          onClick={() => pick("buy", "0.001")}
        >
          {copy.buyTab}
        </button>
        <button
          type="button"
          className={side === "sell" ? "on sell" : ""}
          onClick={() => pick("sell", "100")}
        >
          {copy.sellTab}
        </button>
      </div>

      <label className="field">
        <span>{zeroForOne ? copy.buyField : copy.sellField}</span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>

      <p className="swap-out mono">{zeroForOne ? copy.buyOutput : copy.sellOutput}</p>
      <p className="faint small mono">{zeroForOne ? copy.buyMinimum : copy.sellMinimum}</p>

      {phase ? <p className="banner-lock" data-testid="swap-pending">{PHASE_COPY[phase]}</p> : null}
      {success ? <p className="up">{success}</p> : null}
      {error ? (
        <p className="banner-error" role="alert">
          {error}
        </p>
      ) : null}
      {shortOnFunds ? <p className="banner-error">{shortCopy}</p> : null}

      <button
        type="button"
        className={`btn full ${zeroForOne ? "primary" : "sell"}`}
        disabled={!canSend}
        onClick={submit}
      >
        {pending
          ? zeroForOne
            ? copy.buying
            : copy.selling
          : zeroForOne
            ? copy.buyCta
            : copy.sellCta}
      </button>

      {!zeroForOne ? <p className="faint small">{copy.confirmHelp}</p> : null}
      <p className="faint small">{copy.feeNote}</p>
    </section>
  );
}
