import { Link } from "react-router-dom";
import { CommentItem } from "../components/CommentItem";
import { SampleBadge } from "../components/SampleBadge";
import { graduated, progress } from "../lib/curve";
import { ago, gwei } from "../lib/format";
import { isMockMode } from "../lib/mode";
import { price, useStore, type Coin } from "../lib/store";

export function HomePage() {
  const mock = isMockMode();
  const s = useStore();
  const coins = mock ? s.coins : [];
  const talkCount = (id: string) => s.comments.filter((c) => c.coinId === id).length;
  const live = coins.filter((c) => !graduated(c));
  const featured = [...live].sort((a, b) => progress(b) - progress(a))[0] ?? null;
  const grid = featured ? coins.filter((c) => c.id !== featured.id) : coins;
  const coinById = new Map(s.coins.map((c) => [c.id, c]));
  const feed = mock ? [...s.comments].sort((a, b) => b.at - a.at).slice(0, 14) : [];
  return (
    <main className="home">
      <div className="stack">
        <div className="home-toolbar">
          <h1>Prophecies</h1>
          <SampleBadge />
        </div>

        {featured ? (
          <Link className="featured" to={`/coin/${featured.id}`}>
            <div>
              <p className="featured-kicker">Closest to graduation</p>
              <p className="featured-text">{featured.prophecy}</p>
              <div className="featured-meta">
                <span className="launch-ticker">${featured.ticker}</span>
                <span className="strong">Price {gwei(price(featured))}</span>
                <span className="faint small">{ago(featured.createdAt)}</span>
              </div>
            </div>
            <div className="featured-side">
              <span className="bar">
                <span className="bar-fill" style={{ width: `${(progress(featured) * 100).toFixed(1)}%` }} />
              </span>
              <span className="faint small">
                Curve {(progress(featured) * 100).toFixed(0)}%
              </span>
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
          {grid.length === 0 ? (
            <p className="empty">
              {mock ? "No prophecies yet." : "No on-chain prophecies to show yet."}
            </p>
          ) : (
            <div className="token-grid">
              {grid.map((coin) => (
                <LaunchCard key={coin.id} coin={coin} talk={talkCount(coin.id)} />
              ))}
            </div>
          )}
        </section>
      </div>

      {mock ? (
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
      ) : null}
    </main>
  );
}

function LaunchCard({ coin, talk }: { coin: Coin; talk: number }) {
  return (
    <Link className="launch" to={`/coin/${coin.id}`}>
      <div className="launch-head">
        <span className="launch-ticker">${coin.ticker}</span>
        <span className="faint small">{ago(coin.createdAt)}</span>
      </div>
      <p className="launch-text">{coin.prophecy}</p>
      <div className="launch-foot">
        <span className="strong">{gwei(price(coin))}</span>
        <span className="faint small">{talk} {talk === 1 ? "memo" : "memos"}</span>
      </div>
      <span className="bar">
        <span className="bar-fill" style={{ width: `${(progress(coin) * 100).toFixed(1)}%` }} />
      </span>
    </Link>
  );
}
