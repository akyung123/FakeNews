import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { formatEther, type Address } from "viem";
import { useAccount } from "wagmi";
import { SampleBadge } from "../components/SampleBadge";
import { TokenName, tokenDisplayName } from "../components/TokenName";
import { auctionStatusCopy } from "../lib/cca/copy";
import { loadMarketSnapshots, type MarketRow, type MarketSnapshot } from "../lib/cca/loadAuction";
import { hasLaunchpad } from "../lib/contracts";
import { price, quoteSell } from "../lib/curve";
import { webEnv } from "../lib/env";
import { unfollow, useFollowing } from "../lib/following";
import { eth, ethFromWei, gwei, tokens } from "../lib/format";
import { loadMyHoldings, type MyHoldings } from "../lib/holdings";
import { loadLaunchedCoins } from "../lib/launched";
import { isMockMode } from "../lib/mode";
import {
  getProphetPage,
  latestProphecy,
  prophecyDetailPath,
  prophetEnsName,
  prophetPagePath,
  prophetProphecies,
  type ProphetProphecy,
} from "../lib/prophetData";
import { myPosition, useStore, type Coin, type Position } from "../lib/store";

export type MyPageProps = {
  loadHoldings?: (wallet: Address) => Promise<MyHoldings>;
  loadLaunched?: () => Promise<Coin[]>;
  loadMarkets?: (rows: MarketRow[]) => Promise<Map<Address, MarketSnapshot>>;
};

export function MyPage({ loadHoldings, loadLaunched, loadMarkets }: MyPageProps = {}) {
  const mock = isMockMode() && !loadHoldings && !loadLaunched;
  const s = useStore();
  const { hash } = useLocation();

  useEffect(() => {
    if (hash !== "#following") return;
    document.getElementById("following")?.scrollIntoView?.({ block: "start" });
  }, [hash]);

  const following = (
    <FollowingSection chain={!mock} loadLaunched={loadLaunched} loadMarkets={loadMarkets} />
  );

  if (!mock) {
    return (
      <main className="stack">
        <h1>My prophecies</h1>
        <ChainSummary loadHoldings={loadHoldings} />
        {following}
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

      {following}
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

  const show = (wei: bigint | undefined) => (wei === undefined ? "…" : ethFromWei(wei));
  return (
    <section className="block summary" aria-busy={data ? "false" : "true"}>
      <div>
        <p className="faint small">Holdings value</p>
        <p className="big-num">{show(data?.holdingsValueWei)}</p>
      </div>
      <div>
        <p className="faint small">Tokens held</p>
        <p className="big-num">{data ? tokens(Number(formatEther(data.tokensHeldWei))) : "…"}</p>
      </div>
      <div>
        <p className="faint small">ETH spent on bids</p>
        <p className="big-num">{show(data?.bidSpentWei)}</p>
      </div>
      {data && data.feesWei !== null ? (
        <div>
          <p className="faint small">Fees ready to claim</p>
          <p className="big-num">{ethFromWei(data.feesWei)}</p>
        </div>
      ) : null}
    </section>
  );
}

type FollowRow = { label: string; ensName: string; latest: ProphetProphecy | null };

function FollowingSection({
  chain,
  loadLaunched,
  loadMarkets,
}: {
  chain: boolean;
  loadLaunched?: () => Promise<Coin[]>;
  loadMarkets?: (rows: MarketRow[]) => Promise<Map<Address, MarketSnapshot>>;
}) {
  const labels = useFollowing();
  const [coins, setCoins] = useState<Coin[] | null>(null);
  const [markets, setMarkets] = useState<Map<Address, MarketSnapshot>>(() => new Map());

  useEffect(() => {
    if (!chain || labels.length === 0) return;
    let cancelled = false;
    void (loadLaunched ?? (() => loadLaunchedCoins()))()
      .then((rows) => {
        if (!cancelled) setCoins(rows);
      })
      .catch(() => {
        if (!cancelled) setCoins([]);
      });
    return () => {
      cancelled = true;
    };
  }, [chain, labels.length, loadLaunched]);

  const rows: FollowRow[] = labels.map((label) => {
    if (chain) {
      return {
        label,
        ensName: prophetEnsName(label, webEnv.parentName),
        latest: latestProphecy(prophetProphecies(label, coins ?? [])),
      };
    }
    const page = getProphetPage(label);
    return {
      label,
      ensName: page?.prophet.ensName ?? prophetEnsName(label),
      latest: page ? latestProphecy(page.prophecies) : null,
    };
  });
  const tokenKey = rows
    .map((row) => row.latest?.token ?? "")
    .filter(Boolean)
    .join(",");

  useEffect(() => {
    // Sample prophecies have no auction, so no stage chip in demo mode.
    if (!chain || !tokenKey) return;
    const wanted: MarketRow[] = [];
    for (const row of rows) {
      if (row.latest) wanted.push({ token: row.latest.token, auction: row.latest.auction });
    }
    let cancelled = false;
    void (loadMarkets ?? ((r: MarketRow[]) => loadMarketSnapshots(r)))(wanted)
      .then((next) => {
        if (!cancelled) setMarkets(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // rows is rebuilt every render; tokenKey is what changes the reads.
  }, [chain, tokenKey, loadMarkets]);

  return (
    <section className="block" id="following">
      <div className="block-head">
        <h2>Following</h2>
        <span className="faint">saved in this browser</span>
      </div>
      {rows.length === 0 ? (
        <p className="empty">
          You're not following any prophets yet. <Link to="/">Browse prophecies</Link>
        </p>
      ) : (
        <ul className="posts">
          {rows.map((row) => {
            const market = row.latest ? markets.get(row.latest.token) : undefined;
            return (
              <li key={row.label} className="post">
                <div className="post-head">
                  <strong>{row.ensName}</strong>
                  {chain && market ? (
                    <span className="hold">{auctionStatusCopy(market.status, market.statusVars)}</span>
                  ) : null}
                </div>
                <p className="post-text">
                  {row.latest ? (
                    row.latest.sentence || <TokenName slug={row.latest.slug} ensName={row.latest.ensName} />
                  ) : (
                    <span className="faint">This prophet has not written one yet.</span>
                  )}
                </p>
                <p className="post-meta">
                  {row.latest ? (
                    <>
                      <Link to={prophecyDetailPath(row.latest.ensName)}>Open prophecy</Link>
                      {" · "}
                    </>
                  ) : null}
                  <Link to={prophetPagePath(row.label)}>Prophet page</Link>
                  {" · "}
                  <button type="button" className="link" onClick={() => unfollow(row.label)}>
                    Unfollow
                  </button>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
