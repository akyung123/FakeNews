import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatEther } from "viem";
import { Bar } from "../components/CoinCard";
import {
  getProphetPage,
  prophecyDetailPath,
  type ProphetPageData,
  type ProphetProphecy,
} from "../lib/prophetData";

export function ProphetPage() {
  const { name = "" } = useParams();
  const data = getProphetPage(name);
  if (!data) {
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
  return <ProphetView data={data} />;
}

function ProphetView({ data }: { data: ProphetPageData }) {
  const [claimed, setClaimed] = useState(false);
  const feeWei = claimed ? 0n : data.claimableFeeWei;

  return (
    <main className="prophet-page stack">
      <section className="block prophet-hero">
        <p className="faint small">Prophet</p>
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
        <button
          type="button"
          className="btn primary"
          disabled={claimed || feeWei === 0n}
          onClick={() => setClaimed(true)}
        >
          {claimed ? "Claimed" : "Claim fees"}
        </button>
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
                    <span className="row-title">{row.ensName}</span>
                    <span className="row-sub">{row.slug}</span>
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
                  <span className="strong">Trade</span>
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
