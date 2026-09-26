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
                <span className="mono col-token" title={row.token}>
                  {shortAddress(row.token)}
                </span>
                <span className="cell-curve col-curve">
                  <CurveMark row={row} />
                </span>
                <span className="num">
                  <span className="strong">Buy</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function CurveMark({ row }: { row: ProphetProphecy }) {
  if (row.complete) {
    return <span className="strong">Graduated</span>;
  }
  const pctText = `${(row.curveProgress * 100).toFixed(0)}%`;
  return (
    <>
      <Bar value={row.curveProgress} />
      <span className="faint">{pctText}</span>
    </>
  );
}

function formatFee(wei: bigint): string {
  const value = formatEther(wei);
  return `${value} ETH`;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
