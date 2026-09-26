import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatEther } from "viem";
import { CcaTrade } from "../components/CcaTrade";
import { CommentItem } from "../components/CommentItem";
import { Bar } from "../components/CoinCard";
import { PriceChart } from "../components/PriceChart";
import { SampleBadge } from "../components/SampleBadge";
import { TokenName, tokenDisplayName } from "../components/TokenName";
import { CCA_COPY, raisedProgressCopy } from "../lib/cca";
import { usePoolPrice } from "../lib/cca/usePoolPrice";
import { contracts, hasLaunchpad } from "../lib/contracts";
import { coinPriceWei, coinProgress, coinRaisedWei } from "../lib/coinFigures";
import { graduated, TOTAL_SUPPLY } from "../lib/curve";
import { follow, unfollow, useFollowing } from "../lib/following";
import { ago, ethToWei, formatEth, formatPrice, tokens } from "../lib/format";
import {
  GRADUATED_BODY,
  GRADUATED_LINK,
  GRADUATED_TITLE,
} from "../lib/graduation";
import { findLaunchedCoin, loadLaunchedCoins } from "../lib/launched";
import { memoRemainingLabel } from "../lib/limits";
import { prototypeCoinFromName } from "../lib/prophetData";
import {
  actions,
  myPosition,
  useStore,
  type Coin,
} from "../lib/store";
import { useEthBalance, useTokenBalance } from "../lib/useWalletBalance";
import {
  isChainWriteTarget,
  liveTokenAddress,
  type BuyInput,
  type SellInput,
} from "../lib/writes";

export type CoinPageProps = {
  sendBuy?: (input: BuyInput) => Promise<boolean>;
  sendSell?: (input: SellInput) => Promise<boolean>;
  loadLaunched?: () => Promise<Coin[]>;
};

export function CoinPage({
  loadLaunched,
}: CoinPageProps = {}) {
  const { id = "", name = "" } = useParams();
  const s = useStore();
  const lookup = id || name;
  const chain = hasLaunchpad() || Boolean(loadLaunched);
  const [chainCoin, setChainCoin] = useState<Coin | null>(null);
  const [chainReady, setChainReady] = useState(!chain);

  useEffect(() => {
    if (!chain) return;
    let cancelled = false;
    const run = loadLaunched ?? (() => loadLaunchedCoins());
    void run()
      .then((rows) => {
        if (cancelled) return;
        setChainCoin(findLaunchedCoin(lookup, rows) ?? null);
        setChainReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setChainCoin(null);
        setChainReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [chain, loadLaunched, lookup]);

  const fromStore = s.coins.find((c) => c.id === lookup || c.token === lookup || c.name === lookup);
  // Chain mode keeps only coins this browser launched on chain; demo seed rows stay in demo mode.
  const coin = chain
    ? ((fromStore?.fromChain ? fromStore : undefined) ?? chainCoin)
    : (fromStore ?? prototypeCoinFromName(lookup));
  // Once migrate opens the pool, slot0 is the live price; before that the
  // auction's clearing price is, and the hook stays closed.
  const poolPrice = usePoolPrice(coin?.token, contracts.hook);
  const ethBalance = useEthBalance();
  const tokenBalance = useTokenBalance(coin ? liveTokenAddress(coin.id, coin.token) : undefined);
  const following = useFollowing();
  if (!coin) {
    if (chain && !chainReady) {
      return <main className="coin-page" />;
    }
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
  const held = chain ? (tokenBalance ?? 0) : (pos?.tokens ?? 0);
  const talk = s.comments.filter((c) => c.coinId === coin.id).sort((a, b) => b.at - a.at);
  const closed = graduated(coin) || Boolean(coin.complete);
  const chartPoints = poolPrice.open
    ? poolPrice.history.map((p) => ({ at: p.at, value: Number(formatEther(p.wei)) }))
    : coin.history.map((h) => ({ at: h.at / 1000, value: h.mcap / TOTAL_SUPPLY }));

  return (
    <main className="coin-page">
      <div className="stack">
        <section className="block">
          <div className="coin-id">
            <div>
              <div className="coin-name">
                <TokenName {...tokenDisplayName(coin)} copy />
                <span className="faint">${coin.ticker}</span>
                <SampleBadge />
              </div>
              <p className="faint small coin-by">
                {coin.creator ? (
                  <>
                    by <Link to={`/p/${coin.creator}`}>{coin.creator}</Link>{" "}
                    <FollowToggle label={coin.creator} followed={following.includes(coin.creator.toLowerCase())} />
                  </>
                ) : null}
                {coin.creator && ago(coin.createdAt) ? " · " : null}
                {ago(coin.createdAt)}
              </p>
            </div>
          </div>
          <h1 className="prophecy-title">{coin.prophecy}</h1>
          <p className="price-now">{formatPrice(poolPrice.open ? poolPrice.priceWei : coinPriceWei(coin))}</p>
          <p className="big-num">{auctionProgressHeader(coin)}</p>
          <p className="faint">
            {poolPrice.open
              ? CCA_COPY.poolOpen
              : closed
                ? CCA_COPY.finalClearingPrice
                : CCA_COPY.currentClearingPrice}
          </p>
          <PriceChart
            points={chartPoints}
            label={poolPrice.open ? "Pool price (ETH per token)" : "Price (ETH per token)"}
            live={poolPrice.open}
            format={(value) => formatEth(ethToWei(value))}
            emptyText="No trades yet. The chart starts with the first trade."
          />
          <Bar value={coinProgress(coin)} labelled />
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
        {!chain || isChainWriteTarget(coin) ? (
          <CcaTrade
            coin={coin}
            balance={chain ? (ethBalance ?? 0) : s.balance}
            held={held}
            chain={chain}
          />
        ) : null}
        {held > 0 ? (
          <section className="block you-hold">
            <p className="faint small">You hold</p>
            <p className="you-amount">
              {tokens(held)} <span className="faint">${coin.ticker}</span>
            </p>
          </section>
        ) : null}
      </aside>
    </main>
  );
}

export function TradeBox({
  coin,
  balance,
  held,
  chain = false,
}: {
  coin: Coin;
  balance: number;
  held: number;
  graduation?: unknown;
  chain?: boolean;
  sendBuy?: (input: BuyInput) => Promise<boolean>;
  sendSell?: (input: SellInput) => Promise<boolean>;
}) {
  return <CcaTrade coin={coin} balance={balance} held={held} chain={chain} />;
}

export function GraduationPanel({ href }: { href: string }) {
  return (
    <section className="block trade">
      <h2>{GRADUATED_TITLE}</h2>
      <p className="faint">{GRADUATED_BODY}</p>
      <a className="link" href={href} target="_blank" rel="noreferrer">
        {GRADUATED_LINK}
      </a>
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
      <span className="faint small" data-testid="memo-left">
        {memoRemainingLabel(text)}
      </span>
    </form>
  );
}

function auctionProgressHeader(coin: Coin): string {
  return raisedProgressCopy(coinRaisedWei(coin));
}

/** Same toggle as the prophet page header: Follow → Following, click again to unfollow. */
function FollowToggle({ label, followed }: { label: string; followed: boolean }) {
  return followed ? (
    <button type="button" className="btn ghost small" aria-pressed="true" onClick={() => unfollow(label)}>
      Following
    </button>
  ) : (
    <button type="button" className="btn primary small" aria-pressed="false" onClick={() => follow(label)}>
      Follow
    </button>
  );
}
