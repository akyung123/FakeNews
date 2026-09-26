import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar } from "../components/CoinCard";
import { CommentItem } from "../components/CommentItem";
import { SampleBadge } from "../components/SampleBadge";
import { TokenName, tokenDisplayName } from "../components/TokenName";
import { hasLaunchpad } from "../lib/contracts";
import {
  coinPriceWei,
  coinProgress,
  coinRaisedWei,
  coinStage,
  newestFirst,
  pickFeatured,
  STAGE_BADGE,
  STAGE_CLASS,
  type CoinStage,
} from "../lib/coinFigures";
import { ago, formatEth, formatPrice } from "../lib/format";
import { loadLaunchedCoins } from "../lib/launched";
import { useStore, type Coin } from "../lib/store";

export type HomePageProps = {
  loadLaunched?: () => Promise<Coin[]>;
};

type StageFilter = "all" | CoinStage;

const STAGE_FILTERS: { key: StageFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "market_open", label: "Market open" },
  { key: "ended", label: "Ended" },
];

const EMPTY_STAGE: Record<CoinStage, string> = {
  live: "No auction is live right now.",
  market_open: "No market is open yet.",
  ended: "No auction has ended below its goal.",
};

/** A market that opened sold its whole auction, so its bar reads full. */
function stageProgress(coin: Coin, stage: CoinStage | null): number {
  return stage === "market_open" ? 1 : coinProgress(coin);
}

function memoCount(n: number): string {
  return `${n} ${n === 1 ? "memo" : "memos"}`;
}

export function HomePage({ loadLaunched }: HomePageProps = {}) {
  const s = useStore();
  const chain = hasLaunchpad() || Boolean(loadLaunched);
  const [chainCoins, setChainCoins] = useState<Coin[] | null>(null);
  const [filter, setFilter] = useState<StageFilter>("all");

  useEffect(() => {
    if (!chain) return;
    let cancelled = false;
    const run = loadLaunched ?? (() => loadLaunchedCoins());
    void run()
      .then((rows) => {
        if (!cancelled) setChainCoins(rows);
      })
      .catch(() => {
        if (!cancelled) setChainCoins([]);
      });
    return () => {
      cancelled = true;
    };
  }, [chain, loadLaunched]);

  const coins = chain ? (chainCoins ?? []) : s.coins;
  const talkCount = (id: string) => s.comments.filter((c) => c.coinId === id).length;
  const featured = pickFeatured(coins);
  const featuredStage = featured ? coinStage(featured) : null;
  // "All" skips the featured card, which sits right above; a stage filter lists every match.
  const grid = newestFirst(coins).filter((c) =>
    filter === "all" ? c.id !== featured?.id : coinStage(c) === filter,
  );
  const coinById = new Map(coins.map((c) => [c.id, c]));
  const feed = [...s.comments].sort((a, b) => b.at - a.at).slice(0, 14);

  return (
    <main className={chain ? "home solo" : "home"}>
      <div className="stack">
        <div className="home-toolbar">
          <h1>Prophecies</h1>
          <SampleBadge />
        </div>
        <p className="home-hero faint">
          Write one line. Launch it as a token. Your name keeps it on ENS forever.
        </p>

        {featured && featuredStage ? (
          <Link className={`featured ${STAGE_CLASS[featuredStage]}`} to={`/coin/${featured.id}`}>
            <span className="stage-badge">{STAGE_BADGE[featuredStage]}</span>
            {featured.prophecy ? <p className="featured-text">{featured.prophecy}</p> : null}
            <div className="featured-meta">
              <TokenName {...tokenDisplayName(featured)} />
              <div className="featured-quote">
                <span className="faint">${featured.ticker}</span>
                <span className="featured-price">
                  <span className="strong">Price {formatPrice(coinPriceWei(featured))}</span>
                  {ago(featured.createdAt) ? <span className="faint small">{ago(featured.createdAt)}</span> : null}
                </span>
              </div>
            </div>
            <div className="featured-side">
              <Bar value={stageProgress(featured, featuredStage)} />
              {coinRaisedWei(featured) > 0n ? (
                <span className="featured-raised faint small">Raised {formatEth(coinRaisedWei(featured))}</span>
              ) : null}
              <span className="featured-memos faint small">{memoCount(talkCount(featured.id))}</span>
            </div>
          </Link>
        ) : null}

        <section className="block">
          <div className="block-head">
            <h2>Just launched</h2>
            <span className="faint">newest first</span>
          </div>
          {coins.length === 0 ? (
            <div className="empty">
              <p>No prophecies yet. Be the first.</p>
              <Link to="/create" className="btn primary">
                Launch a prophecy
              </Link>
            </div>
          ) : (
            <>
              <div className="stage-filter" role="group" aria-label="Filter by market stage">
                {STAGE_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className={filter === f.key ? "chip on" : "chip"}
                    aria-pressed={filter === f.key}
                    onClick={() => setFilter(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {grid.length === 0 && filter !== "all" ? (
                <p className="empty">{EMPTY_STAGE[filter]}</p>
              ) : (
                <div className="token-grid">
                  {grid.map((coin) => (
                    <LaunchCard key={coin.id} coin={coin} talk={talkCount(coin.id)} />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {chain ? null : (
        <section className="block talk">
          <div className="block-head">
            <h2>Trade memos</h2>
            <span className="faint">from recent trades</span>
          </div>
          <ul className="posts">
            {feed.map((c) => {
              const coin = coinById.get(c.coinId);
              return coin ? <CommentItem key={c.id} comment={c} coin={coin} showCoin /> : null;
            })}
          </ul>
        </section>
      )}
    </main>
  );
}

function LaunchCard({ coin, talk }: { coin: Coin; talk: number }) {
  const stage = coinStage(coin);
  const when = ago(coin.createdAt);
  return (
    <Link className={stage ? `launch ${STAGE_CLASS[stage]}` : "launch"} to={`/coin/${coin.id}`}>
      {stage ? <span className="stage-badge">{STAGE_BADGE[stage]}</span> : null}
      <div className="launch-head">
        <div className="launch-name">
          <TokenName {...tokenDisplayName(coin)} />
        </div>
        <div className="launch-meta">
          <span className="launch-ticker faint">${coin.ticker}</span>
          {when ? <span className="launch-date faint small">{when}</span> : null}
        </div>
      </div>
      <span className="launch-rule" aria-hidden="true" />
      <p className="launch-text">{coin.prophecy}</p>
      <div className="launch-foot">
        <p className="strong">{formatPrice(coinPriceWei(coin))}</p>
        <p className="launch-memos faint small">{memoCount(talk)}</p>
        <Bar value={stageProgress(coin, stage)} />
      </div>
    </Link>
  );
}
