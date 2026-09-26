import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { Address } from "viem";
import { TokenName } from "../components/TokenName";
import { auctionStatusCopy } from "../lib/cca/copy";
import { loadMarketSnapshots, type MarketRow, type MarketSnapshot } from "../lib/cca/loadAuction";
import { hasLaunchpad } from "../lib/contracts";
import { webEnv } from "../lib/env";
import { unfollow, useFollowing } from "../lib/following";
import { ago, formatPrice } from "../lib/format";
import { ISSUE_COPY } from "../lib/issue";
import { loadLaunchedCoins } from "../lib/launched";
import {
  getProphetPage,
  newestFirst,
  prophecyDetailPath,
  prophecyFromCoin,
  prophetEnsName,
  prophetPagePath,
  type ProphetProphecy,
} from "../lib/prophetData";
import type { Coin } from "../lib/store";
import { DEFAULT_AVATAR } from "./ProphetPage";

export type FollowingPageProps = {
  loadLaunched?: () => Promise<Coin[]>;
  loadMarkets?: (rows: MarketRow[]) => Promise<Map<Address, MarketSnapshot>>;
};

type FeedItem = {
  label: string;
  row: ProphetProphecy;
  /** Launch time from the Launched list. Sample rows have none. */
  at?: number;
};

const LOAD_FAILED = "Something went wrong. Try again later.";

/** `{slug}.{label}.{parent}` → label. Anything else is not a prophecy name. */
export function prophetLabelOfName(name: string, parent = webEnv.parentName): string | null {
  const suffix = `.${parent}`.toLowerCase();
  const lower = name.trim().toLowerCase();
  if (!lower.endsWith(suffix)) return null;
  const parts = lower.slice(0, -suffix.length).split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return parts[1];
}

/** Prophecies by followed prophets, newest launch first. */
export function followingFeed(coins: readonly Coin[], labels: readonly string[], parent = webEnv.parentName): FeedItem[] {
  const out: FeedItem[] = [];
  for (const coin of coins) {
    const label = prophetLabelOfName(coin.name, parent);
    if (!label || !labels.includes(label)) continue;
    const row = prophecyFromCoin(coin);
    if (row) out.push({ label, row, at: coin.createdAt });
  }
  return out.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
}

function sampleFeed(labels: readonly string[]): FeedItem[] {
  const byToken = new Map<string, string>();
  const rows: ProphetProphecy[] = [];
  for (const label of labels) {
    for (const row of getProphetPage(label)?.prophecies ?? []) {
      byToken.set(row.token, label);
      rows.push(row);
    }
  }
  return newestFirst(rows).map((row) => ({ label: byToken.get(row.token)!, row }));
}

export function FollowingPage({ loadLaunched, loadMarkets }: FollowingPageProps = {}) {
  const chain = hasLaunchpad() || Boolean(loadLaunched);
  const labels = useFollowing();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [coins, setCoins] = useState<Coin[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [markets, setMarkets] = useState<Map<Address, MarketSnapshot>>(() => new Map());

  const hasFollows = labels.length > 0;
  useEffect(() => {
    if (!chain || !hasFollows) return;
    let cancelled = false;
    setFailed(false);
    void (loadLaunched ?? (() => loadLaunchedCoins()))()
      .then((rows) => {
        if (!cancelled) setCoins(rows);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [chain, hasFollows, loadLaunched, attempt]);

  const all = chain ? followingFeed(coins ?? [], labels) : sampleFeed(labels);
  const tokenKey = all.map((item) => item.row.token).join(",");

  useEffect(() => {
    // Sample prophecies have no auction, so no stage chip in demo mode.
    if (!chain || !tokenKey) return;
    const wanted: MarketRow[] = all.map((item) => ({ token: item.row.token, auction: item.row.auction }));
    let cancelled = false;
    void (loadMarkets ?? ((r: MarketRow[]) => loadMarketSnapshots(r)))(wanted)
      .then((next) => {
        if (!cancelled) setMarkets(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // all is rebuilt every render; tokenKey is what changes the reads.
  }, [chain, tokenKey, loadMarkets]);

  if (!hasFollows) {
    return (
      <main className="narrow stack">
        <h1>Following</h1>
        <section className="block">
          <p className="empty">
            You're not following any prophets yet. <Link to="/">Browse prophecies</Link>
          </p>
        </section>
      </main>
    );
  }

  const asked = params.get("p")?.trim().toLowerCase() ?? "";
  const selected = asked && labels.includes(asked) ? asked : null;
  const feed = selected ? all.filter((item) => item.label === selected) : all;
  const counts = new Map<string, number>();
  for (const item of all) counts.set(item.label, (counts.get(item.label) ?? 0) + 1);
  const filterPath = (label: string | null) => (label ? `/following?p=${encodeURIComponent(label)}` : "/following");
  const toggle = (label: string) => filterPath(selected === label ? null : label);
  const loading = chain && coins === null && !failed;
  // Counts wait for the list so a slow or failed read never reads as "0 prophecies".
  const counted = !chain || coins !== null;

  return (
    <main className="home">
      <div className="stack">
        <h1>Following</h1>
        <nav className="side-nav follow-chips" aria-label="Following">
          <Link
            to={filterPath(null)}
            className={selected ? undefined : "active"}
            aria-current={selected ? undefined : "page"}
          >
            All
          </Link>
          {labels.map((label) => (
            <Link
              key={label}
              to={toggle(label)}
              className={selected === label ? "active" : undefined}
              aria-current={selected === label ? "page" : undefined}
            >
              {prophetEnsName(label, webEnv.parentName)}
            </Link>
          ))}
        </nav>

        <section className="block" aria-busy={loading ? "true" : "false"}>
          <div className="block-head">
            {selected ? (
              <>
                <h2>{prophetEnsName(selected, webEnv.parentName)}</h2>
                <button type="button" className="link small" onClick={() => navigate(filterPath(null))}>
                  Show all
                </button>
              </>
            ) : (
              <>
                <h2>All</h2>
                <span className="faint">newest first</span>
              </>
            )}
          </div>
          {failed ? (
            <div className="empty">
              <p role="alert">{LOAD_FAILED}</p>
              <button type="button" className="btn ghost" onClick={() => setAttempt((n) => n + 1)}>
                {ISSUE_COPY.retry}
              </button>
            </div>
          ) : loading ? null : feed.length === 0 ? (
            <p className="empty">{selected ? "This prophet has not written one yet." : "No activity yet."}</p>
          ) : (
            <ul className="posts">
              {feed.map((item) => (
                <FeedPost key={item.row.token} item={item} market={chain ? markets.get(item.row.token) : undefined} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="block talk follow-list">
        <div className="block-head">
          <h2>Following</h2>
          <span className="faint">saved in this browser</span>
        </div>
        <ul className="posts">
          {labels.map((label) => {
            const n = counts.get(label) ?? 0;
            return (
              <li key={label} className={selected === label ? "post is-you" : "post"}>
                <div className="post-head chart-head">
                  <Link
                    className="cell-coin"
                    to={toggle(label)}
                    aria-current={selected === label ? "true" : undefined}
                  >
                    <img src={DEFAULT_AVATAR} alt="" width={36} height={36} />
                    <span className="cell-coin-text">
                      <strong>{prophetEnsName(label, webEnv.parentName)}</strong>
                      {counted ? (
                        <span className="row-sub">
                          {n} {n === 1 ? "prophecy" : "prophecies"}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                  <button
                    type="button"
                    className="link strong small"
                    onClick={() => {
                      unfollow(label);
                      if (selected === label) navigate(filterPath(null), { replace: true });
                    }}
                  >
                    Unfollow
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

function FeedPost({ item, market }: { item: FeedItem; market?: MarketSnapshot }) {
  const { row } = item;
  return (
    <li className="post">
      <div className="post-head">
        <img src={DEFAULT_AVATAR} alt="" width={20} height={20} />
        <strong>{prophetEnsName(item.label, webEnv.parentName)}</strong>
        {ago(item.at) ? <span className="faint small">{ago(item.at)}</span> : null}
      </div>
      <h2 className="post-text">{row.sentence || <TokenName slug={row.slug} ensName={row.ensName} />}</h2>
      <p className="post-meta">
        <span className="mono">{row.ensName}</span>
        {" · "}
        <Link to={prophecyDetailPath(row.ensName)}>Open prophecy</Link>
        {" · "}
        <Link to={prophetPagePath(item.label)}>Prophet page</Link>
      </p>
      {market ? (
        <p className="post-meta">
          <span className="hold">{auctionStatusCopy(market.status, market.statusVars)}</span>
          {market.priceWei > 0n ? (
            <>
              {" "}
              <span className="strong mono">{formatPrice(market.priceWei)}</span>{" "}
              <span>{market.priceLabel}</span>
            </>
          ) : null}
        </p>
      ) : null}
    </li>
  );
}
