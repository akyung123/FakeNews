import { Link } from "react-router-dom";
import { price, quoteSell } from "../lib/curve";
import { eth, gwei, tokens } from "../lib/format";
import { myPosition, useStore, type Coin, type Position } from "../lib/store";

export function MyPage() {
  const s = useStore();
  const held: { coin: Coin; pos: Position; value: number }[] = [];
  for (const coin of s.coins) {
    const pos = myPosition(s, coin.id);
    if (pos) held.push({ coin, pos, value: quoteSell(coin, pos.tokens) });
  }
  const total = held.reduce((n, h) => n + h.value, 0);
  const cost = held.reduce((n, h) => n + h.pos.cost, 0);

  return (
    <main className="stack">
      <section className="block summary">
        <div>
          <p className="faint small">Sell quote</p>
          <p className="big-num">{eth(total)}</p>
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
          <span className="faint">click one to open its trade memos</span>
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
              <span className="num col-mid">Entry price</span>
              <span className="num col-mid">Price now</span>
              <span className="num">Sell quote</span>
              <span className="num col-opt">Memos</span>
            </div>
            {held.map(({ coin, pos, value }) => {
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
                  <span className="num col-mid">{gwei(pos.cost / pos.tokens)}</span>
                  <span className="num col-mid">{gwei(price(coin))}</span>
                  <span className="num strong">{eth(value)}</span>
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
