import { Link } from "react-router-dom";
import { CommentItem } from "../components/CommentItem";
import { progress } from "../lib/curve";
import { ago, mcap, pct, trend } from "../lib/format";
import { changeSinceLaunch, holderCount, marketCap, useStore, type Coin } from "../lib/store";

export function HomePage() {
  const s = useStore();
  const talkCount = (id: string) => s.comments.filter((c) => c.coinId === id).length;
  const top = [...s.coins].sort((a, b) => marketCap(b) - marketCap(a));
  const latest = [...s.coins].sort((a, b) => b.createdAt - a.createdAt);
  const coinById = new Map(s.coins.map((c) => [c.id, c]));
  const feed = [...s.comments].sort((a, b) => b.at - a.at).slice(0, 14);

  return (
    <main className="home">
      <div className="stack">
        <section className="block">
          <div className="block-head">
            <h2>Just launched</h2>
            <span className="faint">newest first</span>
          </div>
          <div className="launch-grid">
            {latest.slice(0, 6).map((coin) => (
              <LaunchCard key={coin.id} coin={coin} talk={talkCount(coin.id)} />
            ))}
          </div>
        </section>

        <section className="block">
          <div className="block-head">
            <h2>Top prophecies</h2>
            <span className="faint">by market cap</span>
          </div>
          <div className="table" role="table" aria-label="Top prophecies">
            <div className="tr th" role="row">
              <span>#</span>
              <span>Prophecy</span>
              <span className="num">Market cap</span>
              <span className="num">Since launch</span>
              <span className="col-curve">Curve</span>
              <span className="num col-opt">Holders</span>
              <span className="num col-opt">Posts</span>
              <span className="num col-opt">Age</span>
            </div>
            {top.map((coin, i) => {
              const change = changeSinceLaunch(coin);
              return (
                <Link key={coin.id} className="tr" role="row" to={`/coin/${coin.id}`}>
                  <span className="rank">{i + 1}</span>
                  <span className="cell-coin">
                    <span className="cell-coin-text">
                      <span className="row-title">{coin.prophecy}</span>
                      <span className="row-sub">
                        ${coin.ticker} · {coin.creator}
                      </span>
                    </span>
                  </span>
                  <span className="num strong">{mcap(marketCap(coin))}</span>
                  <span className={`num strong ${trend(change)}`}>{pct(change)}</span>
                  <span className="cell-curve col-curve">
                    <span className="bar">
                      <span className="bar-fill" style={{ width: `${(progress(coin) * 100).toFixed(1)}%` }} />
                    </span>
                    <span className="faint">{(progress(coin) * 100).toFixed(0)}%</span>
                  </span>
                  <span className="num col-opt">{holderCount(s, coin.id)}</span>
                  <span className="num col-opt">{talkCount(coin.id)}</span>
                  <span className="num col-opt faint">{ago(coin.createdAt)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      <section className="block talk">
        <div className="block-head">
          <h2>Holder talk</h2>
          <span className="faint">only holders can post</span>
        </div>
        <ul className="posts">
          {feed.map((c) => {
            const coin = coinById.get(c.coinId);
            return coin ? <CommentItem key={c.id} comment={c} coin={coin} showCoin /> : null;
          })}
        </ul>
      </section>
    </main>
  );
}

function LaunchCard({ coin, talk }: { coin: Coin; talk: number }) {
  const change = changeSinceLaunch(coin);
  return (
    <Link className="launch" to={`/coin/${coin.id}`}>
      <div className="launch-head">
        <span className="launch-ticker">${coin.ticker}</span>
        <span className="faint small">{ago(coin.createdAt)}</span>
      </div>
      <p className="launch-text">{coin.prophecy}</p>
      <div className="launch-foot">
        <span className="strong">{mcap(marketCap(coin))}</span>
        <span className={`strong ${trend(change)}`}>{pct(change)}</span>
        <span className="faint small">{talk} {talk === 1 ? "post" : "posts"}</span>
      </div>
      <span className="bar">
        <span className="bar-fill" style={{ width: `${(progress(coin) * 100).toFixed(1)}%` }} />
      </span>
    </Link>
  );
}
