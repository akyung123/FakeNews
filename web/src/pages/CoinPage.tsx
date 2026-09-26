import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { parseUnits } from "viem";
import { CommentItem } from "../components/CommentItem";
import { Bar } from "../components/CoinCard";
import { SampleBadge } from "../components/SampleBadge";
import { TokenName, tokenDisplayName } from "../components/TokenName";
import { hasLaunchpad } from "../lib/contracts";
import { graduated, progress, quoteBuy, quoteSell, TOTAL_SUPPLY } from "../lib/curve";
import { ago, eth, gwei, tokens } from "../lib/format";
import {
  GRADUATED_BODY,
  GRADUATED_LINK,
  GRADUATED_TITLE,
  uniswapGraduationHref,
  type GraduationState,
} from "../lib/graduation";
import { findLaunchedCoin, loadLaunchedCoins } from "../lib/launched";
import {
  MEMO_COPY,
  isMemoTooLong,
  memoRemainingLabel,
} from "../lib/limits";
import { GRADUATION_ETH } from "../lib/mock";
import { getProphecyByName, prototypeCoinFromName } from "../lib/prophetData";
import {
  actions,
  myPosition,
  price,
  useStore,
  type Coin,
} from "../lib/store";
import { useGraduation } from "../lib/useGraduation";
import {
  createBuy,
  createSell,
  ethInputToWei,
  isChainWriteTarget,
  liveTokenAddress,
  refreshCoinFromChain,
  writeErrorMessage,
  writePhaseCopy,
  WRITE_COPY,
  type BuyInput,
  type SellInput,
  type WritePhase,
} from "../lib/writes";

export type CoinPageProps = {
  sendBuy?: (input: BuyInput) => Promise<boolean>;
  sendSell?: (input: SellInput) => Promise<boolean>;
  loadLaunched?: () => Promise<Coin[]>;
};

export function CoinPage({
  sendBuy = createBuy(),
  sendSell = createSell(),
  loadLaunched,
}: CoinPageProps = {}) {
  const { id = "", name = "" } = useParams();
  const s = useStore();
  const lookup = id || name;
  const chain = hasLaunchpad() || Boolean(loadLaunched);
  const [chainCoin, setChainCoin] = useState<Coin | null>(null);
  const [chainReady, setChainReady] = useState(!chain);

  useEffect(() => {
    if (!chain) return;
    let cancelled = false;
    const run = loadLaunched ?? (() => loadLaunchedCoins());
    void run()
      .then((rows) => {
        if (cancelled) return;
        setChainCoin(findLaunchedCoin(lookup, rows) ?? null);
        setChainReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setChainCoin(null);
        setChainReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [chain, loadLaunched, lookup]);

  const fromStore = s.coins.find((c) => c.id === lookup || c.token === lookup || c.name === lookup);
  const coin = chain ? (fromStore ?? chainCoin) : (fromStore ?? prototypeCoinFromName(lookup));
  const token = coin ? (coin.token ?? getProphecyByName(coin.name)?.token) : undefined;
  const graduation = useGraduation(token, coin ? graduated(coin) : false);
  if (!coin) {
    if (chain && !chainReady) {
      return <main className="coin-page" />;
    }
    return (
      <main className="narrow">
        <section className="block">
          <h1>Prophecy not found</h1>
          <Link to="/">Back to all prophecies</Link>
        </section>
      </main>
    );
  }

  const pos = myPosition(s, coin.id);
  const talk = s.comments.filter((c) => c.coinId === coin.id).sort((a, b) => b.at - a.at);

  return (
    <main className="coin-page">
      <div className="stack">
        <section className="block">
          <div className="coin-id">
            <div>
              <div className="coin-name">
                <TokenName {...tokenDisplayName(coin)} copy />
                <span className="faint">${coin.ticker}</span>
                <SampleBadge />
              </div>
              <p className="faint small">
                by {coin.creator} · {ago(coin.createdAt)}
              </p>
            </div>
          </div>
          <h1 className="prophecy-title">{coin.prophecy}</h1>
          <p className="price-now">{gwei(price(coin))}</p>
          <p className="big-num">{curveProgressHeader(coin)}</p>
          {graduation.graduated ? null : <p className="faint">Curve progress</p>}
          <Sparkline coin={coin} />
          <Bar value={progress(coin)} labelled />
        </section>

        <section className="block">
          <div className="block-head">
            <h2>Trade memos</h2>
            <span className="faint">{talk.length} memos</span>
          </div>
          <PostBox coinId={coin.id} holds={Boolean(pos)} />
          <ul className="posts">
            {talk.length === 0 ? <li className="empty">No trades yet. The first memo shows up here.</li> : null}
            {talk.map((c) => (
              <CommentItem key={c.id} comment={c} coin={coin} />
            ))}
          </ul>
        </section>
      </div>

      <aside className="stack side">
        {graduation.graduated ? (
          <GraduationPanel href={uniswapGraduationHref(graduation)} />
        ) : !chain || isChainWriteTarget(coin) ? (
          <TradeBox
            coin={coin}
            balance={s.balance}
            held={pos?.tokens ?? 0}
            graduation={graduation}
            chain={chain}
            sendBuy={sendBuy}
            sendSell={sendSell}
          />
        ) : null}
        {pos ? (
          <section className="block you-hold">
            <p className="faint small">You hold</p>
            <p className="you-amount">
              {tokens(pos.tokens)} <span className="faint">${coin.ticker}</span>
            </p>
          </section>
        ) : null}
      </aside>
    </main>
  );
}

export function TradeBox({
  coin,
  balance,
  held,
  graduation,
  chain = false,
  sendBuy = createBuy(),
  sendSell = createSell(),
}: {
  coin: Coin;
  balance: number;
  held: number;
  graduation: GraduationState;
  chain?: boolean;
  sendBuy?: (input: BuyInput) => Promise<boolean>;
  sendSell?: (input: SellInput) => Promise<boolean>;
}) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("0.001");
  const [memo, setMemo] = useState("");
  const [pending, setPending] = useState(false);
  const [phase, setPhase] = useState<WritePhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const value = Number(amount) || 0;
  const closed = graduation.graduated;
  const memoTooLong = isMemoTooLong(memo);

  const buyQuote = quoteBuy(coin, Math.min(value, balance));
  const sellTokens = Math.min(held, (held * Math.min(value, 100)) / 100);
  const sellQuote = quoteSell(coin, sellTokens).eth;
  const writeTarget = isChainWriteTarget(coin);
  const showWrites = !chain || writeTarget;

  function submit() {
    if (pending || memoTooLong || closed) return;
    if (chain && !writeTarget) return;
    const token = liveTokenAddress(coin.id, coin.token);
    if (!writeTarget || !token) {
      if (side === "buy") actions.buy(coin.id, value);
      else actions.sell(coin.id, sellTokens);
      return;
    }
    void (async () => {
      setPending(true);
      setPhase("wallet");
      setError(null);
      setSuccess(null);
      try {
        if (side === "buy") {
          const sent = await sendBuy({
            token,
            ethIn: ethInputToWei(value),
            memo,
            curve: coin,
            onPhase: setPhase,
          });
          if (!sent) actions.buy(coin.id, value);
        } else {
          const tokensIn = parseUnits(sellTokens.toFixed(8), 18);
          const sent = await sendSell({
            token,
            tokensIn,
            memo,
            curve: coin,
            onPhase: setPhase,
          });
          if (!sent) actions.sell(coin.id, sellTokens);
        }
        await refreshCoinFromChain(coin.id, token).catch(() => undefined);
        setSuccess(WRITE_COPY.tradeSuccess);
      } catch (err) {
        setError(writeErrorMessage(err));
      } finally {
        setPending(false);
        setPhase(null);
      }
    })();
  }

  if (closed) {
    return <GraduationPanel href={uniswapGraduationHref(graduation)} />;
  }

  return (
    <section className="block trade">
      <div className="tabs">
        <button type="button" className={side === "buy" ? "on buy" : ""} onClick={() => { setSide("buy"); setAmount("0.001"); }}>
          Buy
        </button>
        <button type="button" className={side === "sell" ? "on sell" : ""} onClick={() => { setSide("sell"); setAmount("100"); }}>
          Sell
        </button>
      </div>
      <label className="field">
        <span>{side === "buy" ? "Amount (ETH)" : "Amount (% of holding)"}</span>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label className="field">
        <span>Memo</span>
        <input
          aria-label="Memo"
          value={memo}
          autoComplete="off"
          spellCheck={false}
          placeholder="Optional"
          onChange={(e) => setMemo(e.target.value)}
        />
        {memoTooLong ? null : (
          <span className="faint small" data-testid="memo-left">
            {memoRemainingLabel(memo)}
          </span>
        )}
      </label>
      <div className="quick">
        {(side === "buy" ? ["0.0005", "0.001", "0.002", "0.005"] : ["25", "50", "100"]).map((q) => (
          <button type="button" key={q} onClick={() => setAmount(q)}>
            {side === "buy" ? `${q} ETH` : `${q}%`}
          </button>
        ))}
      </div>
      <p className="faint">
        {side === "buy"
          ? `You get ≈ ${tokens(buyQuote.tokens)} $${coin.ticker}`
          : `You get ≈ ${eth(sellQuote, 4)}`}
      </p>
      {pending && writePhaseCopy(phase) ? (
        <p className="banner-lock">{writePhaseCopy(phase)}</p>
      ) : null}
      {success ? <p className="up">{success}</p> : null}
      {error ? (
        <p className="banner-error" role="alert">
          {error}
        </p>
      ) : null}
      {memoTooLong ? (
        <p className="banner-error" role="alert">
          {MEMO_COPY.tooLong}
        </p>
      ) : null}
      {showWrites ? (
        <button
          type="button"
          className={`btn ${side === "buy" ? "primary" : "sell"} full`}
          disabled={pending || memoTooLong || (side === "buy" ? buyQuote.tokens <= 0 : sellTokens <= 0)}
          onClick={submit}
        >
          {pending && phase === "approve"
            ? WRITE_COPY.approve
            : side === "buy"
              ? `Buy $${coin.ticker}`
              : `Sell $${coin.ticker}`}
        </button>
      ) : null}
      <p className="faint small">Cash {eth(balance)}</p>
    </section>
  );
}

export function GraduationPanel({ href }: { href: string }) {
  return (
    <section className="block trade">
      <h2>{GRADUATED_TITLE}</h2>
      <p className="faint">{GRADUATED_BODY}</p>
      <a className="link" href={href} target="_blank" rel="noreferrer">
        {GRADUATED_LINK}
      </a>
    </section>
  );
}

function PostBox({ coinId, holds }: { coinId: string; holds: boolean }) {
  const [text, setText] = useState("");
  if (!holds) return <p className="locked">Hold this prophecy to add a memo.</p>;
  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        actions.comment(coinId, text);
        setText("");
      }}
    >
      <input
        value={text}
        maxLength={140}
        placeholder="Add a one-line memo (optional)"
        onChange={(e) => setText(e.target.value)}
      />
      <button type="submit" className="btn primary" disabled={!text.trim()}>
        Post
      </button>
    </form>
  );
}

function curveProgressHeader(coin: Coin): string {
  const pctFilled = Math.round(progress(coin) * 100);
  const raised = (pctFilled / 100) * GRADUATION_ETH;
  return `${pctFilled}% ${raised.toFixed(4)} of ${GRADUATION_ETH} ETH to graduate`;
}

function Sparkline({ coin }: { coin: Coin }) {
  const points = coin.history.map((h) => h.mcap / TOTAL_SUPPLY);
  if (points.length < 2) return null;
  const w = 600;
  const h = 120;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${((i / (points.length - 1)) * w).toFixed(1)},${(h - ((v - min) / span) * (h - 8) - 4).toFixed(1)}`)
    .join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg className={`spark ${up ? "up" : "down"}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-label="Price over time">
      <path d={d} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
