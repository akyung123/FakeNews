import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { SampleBadge } from "../components/SampleBadge";
import { TokenName, tokenDisplayName } from "../components/TokenName";
import { hasLaunchpad } from "../lib/contracts";
import { price, quoteSell } from "../lib/curve";
import { eth, formatEth, formatPrice, formatTokenAmount, pricePerToken, tokens } from "../lib/format";
import { loadMyHoldings, type HeldRow, type LaunchedRow, type MyHoldings } from "../lib/holdings";
import { isMockMode } from "../lib/mode";
import { myPosition, useStore, type Coin, type Position } from "../lib/store";

export type MyPageProps = {
  loadHoldings?: (wallet: Address) => Promise<MyHoldings>;
  /** Passing a list loader puts the page in chain mode. Followed prophets live on /following. */
  loadLaunched?: () => Promise<Coin[]>;
};

export function MyPage({ loadHoldings, loadLaunched }: MyPageProps = {}) {
  const mock = isMockMode() && !loadHoldings && !loadLaunched;
  const s = useStore();

  if (!mock) {
    return (
      <main className="stack">
        <h1>My prophecies</h1>
        <ChainSummary loadHoldings={loadHoldings} />
      </main>
    );
  }

  const held: { coin: Coin; pos: Position; value: number }[] = [];
  for (const coin of s.coins) {
    const pos = myPosition(s, coin.id);
    if (pos) held.push({ coin, pos, value: quoteSell(coin, pos.tokens).eth });
  }
  const holdingsValue = held.reduce((n, h) => n + h.pos.tokens * price(h.coin), 0);
  const tokensHeld = held.reduce((n, h) => n + h.pos.tokens, 0);
  const cost = held.reduce((n, h) => n + h.pos.cost, 0);

  return (
    <main className="stack">
      <div className="home-toolbar">
        <h1>My prophecies</h1>
        <SampleBadge />
      </div>
      <section className="block summary">
        <div>
          <p className="faint small">Holdings value</p>
          <p className="big-num">{eth(holdingsValue)}</p>
        </div>
        <div>
          <p className="faint small">Tokens held</p>
          <p className="big-num">{tokens(tokensHeld)}</p>
        </div>
        <div>
          <p className="faint small">ETH spent on bids</p>
          <p className="big-num">{eth(cost)}</p>
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
                      <TokenName {...tokenDisplayName(coin)} />
                    </span>
                  </span>
                  <span className="num col-mid">{tokens(pos.tokens)}</span>
                  <span className="num col-mid">{pricePerToken(pos.cost / pos.tokens)}</span>
                  <span className="num col-mid">{pricePerToken(price(coin))}</span>
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

function ChainSummary({ loadHoldings }: { loadHoldings?: (wallet: Address) => Promise<MyHoldings> }) {
  const { address } = useAccount();
  const [data, setData] = useState<MyHoldings | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setData(null);
    setFailed(false);
    if (!address || (!hasLaunchpad() && !loadHoldings)) return;
    let cancelled = false;
    void (loadHoldings ?? loadMyHoldings)(address)
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [address, loadHoldings]);

  if (!address) {
    return (
      <section className="block">
        <p className="empty">Connect a wallet to see your holdings.</p>
      </section>
    );
  }
  if (failed) {
    return (
      <section className="block">
        <p className="empty">Couldn't read your holdings. Try again in a moment.</p>
      </section>
    );
  }

  const show = (wei: bigint | undefined) => (wei === undefined ? "…" : formatEth(wei));
  return (
    <>
    <section className="block summary" aria-busy={data ? "false" : "true"}>
      <div>
        <p className="faint small">Holdings value</p>
        <p className="big-num">{show(data?.holdingsValueWei)}</p>
      </div>
      <div>
        <p className="faint small">Tokens held</p>
        <p className="big-num">{data ? formatTokenAmount(data.tokensHeldWei) : "…"}</p>
      </div>
      <div>
        <p className="faint small">ETH spent on bids</p>
        <p className="big-num">{show(data?.bidSpentWei)}</p>
      </div>
      {data && data.feesWei !== null ? (
        <div>
          <p className="faint small">Fees ready to claim</p>
          <p className="big-num">{formatEth(data.feesWei)}</p>
        </div>
      ) : null}
    </section>
    {data?.held ? <HeldList rows={data.held} /> : null}
    {data?.launched && data.launched.length > 0 ? <LaunchedList rows={data.launched} /> : null}
    </>
  );
}

/** Tokens in this wallet, from claimed bids, swaps or transfers. */
function HeldList({ rows }: { rows: HeldRow[] }) {
  return (
    <section className="block" data-testid="held-list">
      <div className="block-head">
        <h2>Held</h2>
        <span className="faint">prophecy tokens in this wallet</span>
      </div>
      {rows.length === 0 ? (
        <p className="empty">
          You don't hold a prophecy token yet. <Link to="/">Find one</Link>
        </p>
      ) : (
        <div className="table mine" role="table" aria-label="Held prophecies">
          <div className="tr th" role="row">
            <span>Prophecy</span>
            <span className="num col-mid">Holding</span>
            <span className="num col-mid">Price</span>
            <span className="num">Value</span>
          </div>
          {rows.map((row) => (
            <Link key={row.coin.token} className="tr" role="row" to={`/coin/${row.coin.token}`}>
              <span className="cell-coin">
                <span className="cell-coin-text">
                  {row.coin.prophecy ? <span className="row-title">{row.coin.prophecy}</span> : null}
                  <TokenName {...tokenDisplayName(row.coin)} />
                  {row.launchedByYou ? <span className="faint small">You launched this</span> : null}
                </span>
              </span>
              <span className="num col-mid">{formatTokenAmount(row.balanceWei)}</span>
              <span className="num col-mid">{row.priceWei > 0n ? formatPrice(row.priceWei) : "…"}</span>
              <span className="num strong">{row.priceWei > 0n ? formatEth(row.valueWei) : "…"}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/** Prophecies this wallet issued, whether or not it still holds any. */
function LaunchedList({ rows }: { rows: LaunchedRow[] }) {
  return (
    <section className="block" data-testid="launched-list">
      <div className="block-head">
        <h2>Launched by you</h2>
        <span className="faint">newest first</span>
      </div>
      <ul className="posts">
        {rows.map((row) => (
          <li key={row.coin.token} className="post">
            <Link className="cell-coin" to={`/coin/${row.coin.token}`}>
              <span className="cell-coin-text">
                {row.coin.prophecy ? <span className="row-title">{row.coin.prophecy}</span> : null}
                <TokenName {...tokenDisplayName(row.coin)} />
              </span>
            </Link>
            <p className="post-meta">
              {row.balanceWei > 0n ? `Holding ${formatTokenAmount(row.balanceWei)}` : "Not held by this wallet"}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
