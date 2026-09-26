import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CommentItem } from "../components/CommentItem";
import { SampleBadge } from "../components/SampleBadge";
import { TokenName, tokenDisplayName } from "../components/TokenName";
import { hasLaunchpad } from "../lib/contracts";
import { coinPriceWei, coinProgress, coinRaisedWei } from "../lib/coinFigures";
import { graduated } from "../lib/curve";
import { ago, formatEth, formatPrice } from "../lib/format";
import { loadLaunchedCoins } from "../lib/launched";
import { useStore, type Coin } from "../lib/store";

export type HomePageProps = {
  loadLaunched?: () => Promise<Coin[]>;
};

export function HomePage({ loadLaunched }: HomePageProps = {}) {
  const s = useStore();
  const chain = hasLaunchpad() || Boolean(loadLaunched);
  const [chainCoins, setChainCoins] = useState<Coin[] | null>(null);

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
  const live = coins.filter((c) => !graduated(c));
  const featured = [...live].sort((a, b) => coinProgress(b) - coinProgress(a))[0] ?? null;
  const grid = featured ? coins.filter((c) => c.id !== featured.id) : coins;
  const coinById = new Map(coins.map((c) => [c.id, c]));
  const feed = [...s.comments].sort((a, b) => b.at - a.at).slice(0, 14);

  return (
    <main className="home">
      <div className="stack">
        <div className="home-toolbar">
          <h1>Prophecies</h1>
          <SampleBadge />
        </div>
        <p className="home-hero faint">
          Write one line. Launch it as a token. Your name keeps it on ENS forever.
        </p>

        {featured ? (
          <Link className="featured launch" to={`/coin/${featured.id}`}>
            <div>
              <p className="featured-kicker">Auction live</p>
              <p className="featured-text">{featured.prophecy}</p>
              <div className="featured-meta">
                <TokenName {...tokenDisplayName(featured)} />
                <span className="faint">${featured.ticker}</span>
                <span className="strong">Price {formatPrice(coinPriceWei(featured))}</span>
                {ago(featured.createdAt) ? <span className="faint small">{ago(featured.createdAt)}</span> : null}
              </div>
            </div>
            <div className="featured-side">
              <span className="bar">
                <span className="bar-fill" style={{ width: `${(coinProgress(featured) * 100).toFixed(1)}%` }} />
              </span>
              {coinRaisedWei(featured) > 0n ? (
                <span className="faint small">Raised {formatEth(coinRaisedWei(featured))}</span>
              ) : null}
              <span className="faint small">
                {talkCount(featured.id)} {talkCount(featured.id) === 1 ? "memo" : "memos"}
              </span>
            </div>
          </Link>
        ) : null}

        <section className="block">
          <div className="block-head">
            <h2>Just launched</h2>
            <span className="faint">newest first</span>
          </div>
          {grid.length === 0 && !featured ? (
            <div className="empty">
              <p>No prophecies yet. Be the first.</p>
              <Link to="/create" className="btn primary">
                Launch a prophecy
              </Link>
            </div>
          ) : (
            <div className="token-grid">
              {grid.map((coin) => (
                <LaunchCard key={coin.id} coin={coin} talk={talkCount(coin.id)} />
              ))}
            </div>
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
  return (
    <Link className="launch" to={`/coin/${coin.id}`}>
      <div className="launch-head">
        <TokenName {...tokenDisplayName(coin)} />
        <span className="faint">${coin.ticker}</span>
        {ago(coin.createdAt) ? <span className="faint small">{ago(coin.createdAt)}</span> : null}
      </div>
      <p className="launch-text">{coin.prophecy}</p>
      <div className="launch-foot">
        <span className="strong">{formatPrice(coinPriceWei(coin))}</span>
        <span className="faint small">{talk} {talk === 1 ? "memo" : "memos"}</span>
      </div>
      <span className="bar">
        <span className="bar-fill" style={{ width: `${(coinProgress(coin) * 100).toFixed(1)}%` }} />
      </span>
    </Link>
  );
}
