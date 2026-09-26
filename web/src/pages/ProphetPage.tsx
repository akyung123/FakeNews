import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatEther, type Address } from "viem";
import { getAccount } from "wagmi/actions";
import { Bar } from "../components/CoinCard";
import { TokenName } from "../components/TokenName";
import { contracts, hasLaunchpad } from "../lib/contracts";
import { createReadCreatorFee, createReadProphetOf } from "../lib/launchpad";
import {
  canClaimCreatorFee,
  getProphetPage,
  normalizeProphetLabel,
  prophetPageFromChain,
  prophecyDetailPath,
  prophecyTradeLabel,
  type ProphetPageData,
  type ProphetProphecy,
} from "../lib/prophetData";
import { wagmiConfig } from "../lib/wagmi";
import { createClaim, writeErrorMessage, writePhaseCopy, WRITE_COPY, type WritePhase } from "../lib/writes";

export type ProphetPageProps = {
  claimFee?: () => Promise<unknown>;
  loadProphet?: (name: string) => Promise<ProphetPageData | null>;
  readCreatorFee?: (wallet: string) => Promise<bigint>;
};

async function loadOwnChainProphet(name: string): Promise<ProphetPageData | null> {
  if (!hasLaunchpad() || !contracts.launchpad) return null;
  const label = normalizeProphetLabel(name);
  if (!label) return null;
  let wallet: Address | undefined;
  try {
    wallet = getAccount(wagmiConfig).address;
  } catch {
    return null;
  }
  if (!wallet) return null;
  try {
    const onChain = await createReadProphetOf()(wallet);
    if (!onChain || onChain.toLowerCase() !== label) return null;
    const claimableFeeWei = await createReadCreatorFee()(wallet);
    return prophetPageFromChain({ label, wallet, claimableFeeWei });
  } catch {
    return null;
  }
}

export function ProphetPage({ claimFee, loadProphet, readCreatorFee }: ProphetPageProps = {}) {
  const { name = "" } = useParams();
  const chain = hasLaunchpad() || Boolean(loadProphet);
  const mock = getProphetPage(name);
  const [chainData, setChainData] = useState<ProphetPageData | null>(null);
  const [chainReady, setChainReady] = useState(!chain);

  useEffect(() => {
    if (!chain) return;
    let cancelled = false;
    const run = loadProphet ?? loadOwnChainProphet;
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

  const data = chain ? (chainData ?? (chainReady ? mock : null)) : mock;
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
    <ProphetView data={data} chain={chain} claimFee={claimFee} readCreatorFee={readCreatorFee} />
  );
}

function ProphetView({
  data,
  chain,
  claimFee,
  readCreatorFee,
}: {
  data: ProphetPageData;
  chain: boolean;
  claimFee?: () => Promise<unknown>;
  readCreatorFee?: (wallet: string) => Promise<bigint>;
}) {
  const departed = data.prophecies.filter((p) => p.departed);
  const nextBuy = data.prophecies.find((p) => !p.departed);
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

  const feeWei = claimed ? 0n : (onChainFee ?? data.claimableFeeWei);
  const showClaim = canClaimCreatorFee(data, { chain, claimFee });
  const claimDisabled = claimed || feeWei === 0n || pending;

  return (
    <main className="prophet-page stack">
      <section className="block prophet-hero">
        <h1>{data.prophet.ensName}</h1>
        <p className="prophet-wallet">
          <span className="faint small">Wallet</span>
          <code>{data.prophet.wallet}</code>
        </p>
        <p className="faint small">
          {data.prophecies.length} {data.prophecies.length === 1 ? "prophecy" : "prophecies"}
          {data.departedCount > 0 ? ` · ${data.departedCount} Departed` : ""}
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

      <div className="prophet-split">
        <section className="block">
          <div className="block-head">
            <h2>Departed</h2>
            <span className="faint">deadline passed · name still points at the token</span>
          </div>
          {departed.length === 0 ? (
            <p className="empty">None yet. A prophecy stays here after its deadline.</p>
          ) : (
            <ul className="prophet-cards">
              {departed.map((row) => (
                <ProphecyCard key={row.ensName} row={row} />
              ))}
            </ul>
          )}
        </section>

        <section className="block">
          <div className="block-head">
            <h2>Next buy</h2>
            <span className="faint">an open prophecy beside the departed ones</span>
          </div>
          {nextBuy ? (
            <ProphecyCard row={nextBuy} />
          ) : (
            <p className="empty">
              No open prophecy under this name.{" "}
              <Link to="/create">Write the next one</Link>
            </p>
          )}
        </section>
      </div>

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
              <span className="col-deadline">Deadline</span>
              <span className="col-token">Token</span>
              <span className="col-curve">Curve</span>
              <span className="num">Trade</span>
            </div>
            {data.prophecies.map((row) => (
              <Link key={row.ensName} className="tr" role="row" to={prophecyDetailPath(row.ensName)}>
                <span className="cell-coin">
                  <span className="cell-coin-text">
                    <TokenName slug={row.slug} ensName={row.ensName} />
                  </span>
                </span>
                <span className="prophet-sentence">{row.sentence}</span>
                <span className="col-deadline">
                  <Status row={row} />
                </span>
                <span className="mono col-token" title={row.token}>
                  {shortAddress(row.token)}
                </span>
                <span className="cell-curve col-curve">
                  <CurveMark row={row} />
                </span>
                <span className="num">
                  <span className={row.departed ? "prophet-row-sell" : "strong"}>
                    {prophecyTradeLabel(row)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ProphecyCard({ row }: { row: ProphetProphecy }) {
  const href = prophecyDetailPath(row.ensName);
  const label = prophecyTradeLabel(row);
  return (
    <article className="prophet-card">
      <TokenName slug={row.slug} ensName={row.ensName} />
      <p className="prophet-card-sentence">{row.sentence}</p>
      <Status row={row} />
      <p className="faint small mono" title={row.token}>
        Token {shortAddress(row.token)}
      </p>
      <CurveMark row={row} labelled />
      <div className="prophet-card-actions">
        <Link to={href} className={`btn ${label === "Sell" ? "sell" : "primary"}`}>
          {label}
        </Link>
      </div>
    </article>
  );
}

function Status({ row }: { row: ProphetProphecy }) {
  return (
    <span className="prophet-status">
      {row.departed ? <span className="badge departed">Departed</span> : null}
      {row.complete ? <span className="badge graduated">Graduated</span> : null}
      <span className="faint small">{formatDeadline(row.deadline)}</span>
    </span>
  );
}

function CurveMark({ row, labelled }: { row: ProphetProphecy; labelled?: boolean }) {
  if (row.complete) {
    return <span className="strong">Graduated</span>;
  }
  const pctText = `${(row.curveProgress * 100).toFixed(0)}%`;
  return (
    <>
      <Bar value={row.curveProgress} labelled={labelled} />
      {labelled ? null : <span className="faint">{pctText}</span>}
    </>
  );
}

function formatDeadline(sec: number): string {
  return (
    new Date(sec * 1000).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      hour12: false,
    }) + " UTC"
  );
}

function formatFee(wei: bigint): string {
  const value = formatEther(wei);
  return `${value} ETH`;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
