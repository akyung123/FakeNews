import { Link } from "react-router-dom";
import { quoteSell } from "../lib/curve";
import { eth, mcap, pct, tokens, trend } from "../lib/format";
import { entryMcap, marketCap, myPosition, useStore, type Coin, type Position } from "../lib/store";

export function MyPage() {
  const s = useStore();
  const held: { coin: Coin; pos: Position; value: number }[] = [];
  for (const coin of s.coins) {
    const pos = myPosition(s, coin.id);
    if (pos) held.push({ coin, pos, value: quoteSell(coin, pos.tokens) });
  }
  const total = held.reduce((n, h) => n + h.value, 0);
  const cost = held.reduce((n, h) => n + h.pos.cost, 0);
  const change = cost > 0 ? total / cost - 1 : 0;

  return (
    <main className="stack">
      <section className="block summary">
        <div>
          <p className="faint small">Value if sold now</p>
          <p className="big-num">{eth(total)}</p>
        </div>
        <div>
          <p className="faint small">Return if sold now</p>
          <p className={`big-num ${trend(change)}`}>{pct(change)}</p>
        </div>
        <div>
          <p className="faint small">Spent</p>
          <p className="big-num">{eth(cost)}</p>
        </div>
        <div>
          <p className="faint small">Cash</p>
          <p className="big-num">{eth(s.balance)}</p>
        </div>
      </section>

      <section className="block">
        <div className="block-head">
          <h2>My prophecies</h2>
          <span className="faint">click one to open its holder talk</span>
        </div>
        {held.length === 0 ? (
          <p className="empty">
            You don't hold a prophecy yet. <Link to="/">Find one</Link>
          </p>
        ) : (
          <div className="table mine" role="table" aria-label="My prophecies">
            <div className="tr th" role="row">
              <span>Prophecy</span>
              <span className="num col-mid">Holding</span>
              <span className="num col-mid">Bought at (MC)</span>
              <span className="num col-mid">Now (MC)</span>
              <span className="num">If sold now</span>
              <span className="num">Return</span>
              <span className="num col-opt">Posts</span>
            </div>
            {held.map(({ coin, pos, value }) => {
              const c = marketCap(coin) / entryMcap(pos) - 1;
              const talk = s.comments.filter((x) => x.coinId === coin.id).length;
              return (
                <Link key={coin.id} className="tr" role="row" to={`/coin/${coin.id}`}>
                  <span className="cell-coin">
                    <span className="cell-coin-text">
                      <span className="row-title">{coin.prophecy}</span>
                      <span className="row-sub">${coin.ticker}</span>
                    </span>
                  </span>
                  <span className="num col-mid">{tokens(pos.tokens)}</span>
                  <span className="num col-mid">{mcap(entryMcap(pos))}</span>
                  <span className="num col-mid">{mcap(marketCap(coin))}</span>
                  <span className="num strong">{eth(value)}</span>
                  <span className={`num strong ${trend(c)}`}>{pct(c)}</span>
                  <span className="num col-opt">{talk}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
