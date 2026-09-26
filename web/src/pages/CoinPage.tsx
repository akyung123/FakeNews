import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CommentItem } from "../components/CommentItem";
import { Bar } from "../components/CoinCard";
import { graduated, progress, quoteBuy, quoteSell, TOTAL_SUPPLY } from "../lib/curve";
import { isEnsName, slugOf } from "../lib/ensName";
import { ago, eth, tokens } from "../lib/format";
import { GRADUATION_ETH } from "../lib/mock";
import { prototypeCoinFromName } from "../lib/prophetData";
import {
  actions,
  holderCount,
  myPosition,
  useStore,
  type Coin,
} from "../lib/store";

export function CoinPage() {
  const { id = "", name = "" } = useParams();
  const s = useStore();
  const lookup = id || name;
  const coin = s.coins.find((c) => c.id === lookup) ?? prototypeCoinFromName(lookup);
  if (!coin) {
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
              <p className="coin-name">
                {slugOf(coin.name)} <span className="faint">${coin.ticker}</span>
              </p>
              <p className="faint small">
                {isEnsName(coin.name) ? (
                  <>
                    {coin.name} <CopyFullName value={coin.name} />
                    {" · "}
                  </>
                ) : null}
                by {coin.creator} · {ago(coin.createdAt)} · {holderCount(s, coin.id)} holders
              </p>
            </div>
          </div>
          <h1 className="prophecy-title">{coin.prophecy}</h1>
          <p className="big-num">{curveProgressHeader(coin)}</p>
          {graduated(coin) ? (
            <p className="up">Graduated to Uniswap V4</p>
          ) : (
            <p className="faint">Curve progress</p>
          )}
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
        <TradeBox coin={coin} balance={s.balance} held={pos?.tokens ?? 0} />
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

function TradeBox({ coin, balance, held }: { coin: Coin; balance: number; held: number }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("0.001");
  const value = Number(amount) || 0;
  const closed = graduated(coin);

  const buyQuote = quoteBuy(coin, Math.min(value, balance));
  const sellTokens = Math.min(held, (held * Math.min(value, 100)) / 100);
  const sellQuote = quoteSell(coin, sellTokens).eth;

  function submit() {
    if (side === "buy") actions.buy(coin.id, value);
    else actions.sell(coin.id, sellTokens);
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
      <button
        type="button"
        className={`btn ${side === "buy" ? "primary" : "sell"} full`}
        disabled={closed || (side === "buy" ? buyQuote.tokens <= 0 : sellTokens <= 0)}
        onClick={submit}
      >
        {closed ? "Curve sold out" : side === "buy" ? `Buy $${coin.ticker}` : `Sell $${coin.ticker}`}
      </button>
      <p className="faint small">Cash {eth(balance)}</p>
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

function CopyFullName({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="link"
      aria-label="Copy full name"
      onClick={() => {
        if (!navigator.clipboard) return;
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
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
