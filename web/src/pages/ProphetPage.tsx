import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatEther, type Address } from "viem";
import { PriceChart } from "../components/PriceChart";
import { TokenName } from "../components/TokenName";
import { auctionStatusCopy } from "../lib/cca/copy";
import { loadMarketSnapshots, type MarketRow, type MarketSnapshot } from "../lib/cca/loadAuction";
import { hasLaunchpad } from "../lib/contracts";
import { avatarImageUrl } from "../lib/ens";
import { follow, unfollow, useFollowing } from "../lib/following";
import { ethToWei, formatEth, formatPrice, formatPriceAmount } from "../lib/format";
import { createReadCreatorFee } from "../lib/launchpad";
import { loadChainProphet, loadProfileText, type ProfileText } from "../lib/profile";
import {
  canClaimCreatorFee,
  getProphetPage,
  newestFirst,
  prophecyDetailPath,
  type ProphetPageData,
  type ProphetProphecy,
} from "../lib/prophetData";
import { createClaim, writeErrorMessage, writePhaseCopy, WRITE_COPY, type WritePhase } from "../lib/writes";

export type ProphetPageProps = {
  claimFee?: () => Promise<unknown>;
  loadProphet?: (name: string) => Promise<ProphetPageData | null>;
  readCreatorFee?: (wallet: string) => Promise<bigint>;
  loadMarkets?: (rows: MarketRow[]) => Promise<Map<Address, MarketSnapshot>>;
  readProfile?: (ensName: string) => Promise<ProfileText>;
};

/** Default picture when the name has no usable `avatar` record. */
export const DEFAULT_AVATAR = `${import.meta.env?.BASE_URL ?? "/"}skull.svg`;

export function ProphetPage({ claimFee, loadProphet, readCreatorFee, loadMarkets, readProfile }: ProphetPageProps = {}) {
  const { name = "" } = useParams();
  const chain = hasLaunchpad() || Boolean(loadProphet);
  // Sample prophets exist only in demo mode. Chain mode never falls back to them.
  const mock = chain ? null : getProphetPage(name);
  const [chainData, setChainData] = useState<ProphetPageData | null>(null);
  const [chainReady, setChainReady] = useState(!chain);

  useEffect(() => {
    if (!chain) return;
    let cancelled = false;
    const run = loadProphet ?? ((n: string) => loadChainProphet(n));
    void run(name)
      .then((row) => {
        if (cancelled) return;
        setChainData(row);
        setChainReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setChainData(null);
        setChainReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [chain, loadProphet, name]);

  const data = chain ? chainData : mock;
  if (!data) {
    if (chain && !chainReady) {
      return <main className="prophet-page stack" />;
    }
    return (
      <main className="narrow">
        <section className="block">
          <h1>Prophet not found</h1>
          <p className="faint">That name is not in the address book yet.</p>
          <p>
            <Link to="/">Back to all prophecies</Link>
          </p>
        </section>
      </main>
    );
  }
  return (
    <ProphetView
      data={data}
      chain={chain}
      claimFee={claimFee}
      readCreatorFee={readCreatorFee}
      loadMarkets={loadMarkets}
      readProfile={readProfile}
    />
  );
}

function ProphetView({
  data,
  chain,
  claimFee,
  readCreatorFee,
  loadMarkets,
  readProfile,
}: {
  data: ProphetPageData;
  chain: boolean;
  claimFee?: () => Promise<unknown>;
  readCreatorFee?: (wallet: string) => Promise<bigint>;
  loadMarkets?: (rows: MarketRow[]) => Promise<Map<Address, MarketSnapshot>>;
  readProfile?: (ensName: string) => Promise<ProfileText>;
}) {
  const [tab, setTab] = useState<"prophecies" | "activity">("prophecies");
  const [profile, setProfile] = useState<ProfileText>({ avatar: null, description: null });
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [markets, setMarkets] = useState<Map<Address, MarketSnapshot>>(() => new Map());
  const followed = useFollowing().includes(data.prophet.label);
  const [claimed, setClaimed] = useState(false);
  const [pending, setPending] = useState(false);
  const [phase, setPhase] = useState<WritePhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onChainFee, setOnChainFee] = useState<bigint | null>(null);

  useEffect(() => {
    if (!chain || !data.fromChain) {
      setOnChainFee(null);
      return;
    }
    const read = readCreatorFee ?? (hasLaunchpad() ? createReadCreatorFee() : undefined);
    if (!read) {
      setOnChainFee(null);
      return;
    }
    let cancelled = false;
    void read(data.prophet.wallet)
      .then((fee) => {
        if (!cancelled) setOnChainFee(fee);
      })
      .catch(() => {
        if (!cancelled) setOnChainFee(0n);
      });
    return () => {
      cancelled = true;
    };
  }, [chain, data.fromChain, data.prophet.wallet, readCreatorFee]);

  useEffect(() => {
    let cancelled = false;
    setAvatarBroken(false);
    void (readProfile ?? loadProfileText)(data.prophet.ensName)
      .then((text) => {
        if (!cancelled) setProfile(text);
      })
      .catch(() => {
        if (!cancelled) setProfile({ avatar: null, description: null });
      });
    return () => {
      cancelled = true;
    };
  }, [data.prophet.ensName, readProfile]);

  useEffect(() => {
    // Stage and price exist only for launched tokens; sample rows have none.
    if (!data.fromChain || data.prophecies.length === 0) {
      setMarkets((prev) => (prev.size ? new Map() : prev));
      return;
    }
    let cancelled = false;
    const rows = data.prophecies.map((row) => ({ token: row.token, auction: row.auction }));
    void (loadMarkets ?? ((r: MarketRow[]) => loadMarketSnapshots(r, { history: true })))(rows)
      .then((next) => {
        if (!cancelled) setMarkets(next);
      })
      .catch(() => {
        if (!cancelled) setMarkets(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [data.fromChain, data.prophecies, loadMarkets]);

  const avatar = avatarBroken ? null : avatarImageUrl(profile.avatar);
  const feeWei = claimed ? 0n : (onChainFee ?? data.claimableFeeWei);
  const showClaim = canClaimCreatorFee(data, { chain, claimFee });
  const claimDisabled = claimed || feeWei === 0n || pending;

  return (
    <main className="prophet-page stack">
      <section className="block prophet-hero">
        <div className="home-toolbar">
          <img
            src={avatar ?? DEFAULT_AVATAR}
            alt=""
            width={56}
            height={56}
            onError={() => setAvatarBroken(true)}
          />
          <h1>{data.prophet.ensName}</h1>
          {followed ? (
            <button
              type="button"
              className="btn ghost"
              aria-pressed="true"
              onClick={() => unfollow(data.prophet.label)}
            >
              Following
            </button>
          ) : (
            <button
              type="button"
              className="btn primary"
              aria-pressed="false"
              onClick={() => follow(data.prophet.label)}
            >
              Follow
            </button>
          )}
        </div>
        {profile.description ? <p>{profile.description}</p> : null}
        <p className="prophet-wallet">
          <span className="faint small">Wallet</span>
          <code>{data.prophet.wallet}</code>
        </p>
        <p className="faint small">
          {data.prophecies.length} {data.prophecies.length === 1 ? "prophecy" : "prophecies"}
        </p>
      </section>

      <section className="block prophet-fees">
        <div>
          <p className="faint small">Claimable fees</p>
          <p className="big-num">{formatFee(feeWei)}</p>
        </div>
        {showClaim ? (
          <button
            type="button"
            className="btn primary"
            disabled={claimDisabled}
            onClick={() => {
              if (claimDisabled) return;
              void (async () => {
                setPending(true);
                setPhase("wallet");
                setError(null);
                try {
                  await (claimFee ?? createClaim({ onPhase: setPhase }))();
                  setClaimed(true);
                } catch (err) {
                  setError(writeErrorMessage(err));
                } finally {
                  setPending(false);
                  setPhase(null);
                }
              })();
            }}
          >
            {claimed ? WRITE_COPY.claimSuccess : "Claim fees"}
          </button>
        ) : null}
        {pending && writePhaseCopy(phase) ? (
          <p className="banner-lock">{writePhaseCopy(phase)}</p>
        ) : null}
        {claimed ? <p className="up">{WRITE_COPY.claimSuccess}</p> : null}
        {error ? (
          <p className="banner-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="block">
        <div className="tabs" role="tablist" aria-label="Prophet">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "prophecies"}
            className={tab === "prophecies" ? "on buy" : ""}
            onClick={() => setTab("prophecies")}
          >
            Prophecies
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "activity"}
            className={tab === "activity" ? "on buy" : ""}
            onClick={() => setTab("activity")}
          >
            Activity
          </button>
        </div>
      </section>

      {tab === "prophecies" ? (
        <ProphecyTab data={data} markets={markets} />
      ) : (
        <ActivityTab data={data} />
      )}
    </main>
  );
}

function ProphecyTab({ data, markets }: { data: ProphetPageData; markets: Map<Address, MarketSnapshot> }) {
  const priced = data.prophecies.filter((row) => markets.has(row.token));
  return (
    <>
      <section className="block">
        <div className="block-head">
          <h2>Prophecies</h2>
          <span className="faint">each name is slug.{data.prophet.ensName}</span>
        </div>
        {data.prophecies.length === 0 ? (
          <p className="empty">This prophet has not written one yet.</p>
        ) : (
          <div className="table prophet-table" role="table" aria-label="Prophecies">
            <div className="tr th" role="row">
              <span>Name</span>
              <span>Sentence</span>
              <span className="col-token">Token</span>
            </div>
            {data.prophecies.map((row) => (
              <Link key={row.ensName} className="tr" role="row" to={prophecyDetailPath(row.ensName)}>
                <span className="cell-coin">
                  <span className="cell-coin-text">
                    <TokenName slug={row.slug} ensName={row.ensName} />
                  </span>
                </span>
                <span className="prophet-sentence">{row.sentence}</span>
                <span className="mono col-token" title={row.token}>
                  {shortAddress(row.token)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {priced.length > 0 ? (
        <section className="block">
          <div className="block-head">
            <h2>Prices</h2>
            <span className="faint">ETH per token</span>
          </div>
          <ul className="posts">
            {priced.map((row) => (
              <PriceRow key={row.token} row={row} market={markets.get(row.token)!} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function PriceRow({ row, market }: { row: ProphetProphecy; market: MarketSnapshot }) {
  const points = market.history.map((p) => ({ at: p.at, value: Number(formatEther(p.wei)) }));
  return (
    <li className="post">
      <div className="post-head">
        <TokenName slug={row.slug} ensName={row.ensName} />
        <span className="hold">{auctionStatusCopy(market.status, market.statusVars)}</span>
      </div>
      <p className="post-text">
        <span className="faint">{market.priceLabel}</span>{" "}
        <span className="strong mono">
          {market.priceWei > 0n ? formatPrice(market.priceWei) : "Not set yet"}
        </span>
      </p>
      {points.length >= 2 ? (
        <PriceChart
          points={points}
          label={`${market.priceLabel} per token`}
          live={market.status === "pool_open"}
          format={(value) => formatPriceAmount(ethToWei(value))}
        />
      ) : null}
    </li>
  );
}

function ActivityTab({ data }: { data: ProphetPageData }) {
  const rows = newestFirst(data.prophecies);
  return (
    <section className="block">
      <div className="block-head">
        <h2>Activity</h2>
        <span className="faint">newest first</span>
      </div>
      {rows.length === 0 ? (
        <p className="empty">No activity yet.</p>
      ) : (
        <ul className="posts">
          {rows.map((row) => (
            <li key={row.ensName} className="post">
              <div className="post-head">
                <strong>Launched</strong>
                <TokenName slug={row.slug} ensName={row.ensName} />
              </div>
              {row.sentence ? <p className="post-text">{row.sentence}</p> : null}
              <p className="post-meta">
                {row.launchedBlock != null ? `Block ${row.launchedBlock} · ` : null}
                <Link to={prophecyDetailPath(row.ensName)}>Open prophecy</Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatFee(wei: bigint): string {
  return formatEth(wei);
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
