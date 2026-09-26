import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatEther } from "viem";
import { Bar } from "../components/CoinCard";
import {
  getProphetPage,
  prophecyDetailPath,
  prophecyTradeLabel,
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
  const departed = data.prophecies.filter((p) => p.departed);
  const nextBuy = data.prophecies.find((p) => !p.departed);
  const [claimed, setClaimed] = useState(false);
  const feeWei = claimed ? 0n : data.claimableFeeWei;

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
        <button
          type="button"
          className="btn primary"
          disabled={claimed || feeWei === 0n}
          onClick={() => setClaimed(true)}
        >
          {claimed ? "Claimed" : "Claim fees"}
        </button>
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
                    <span className="row-title">{row.ensName}</span>
                    <span className="row-sub">{row.slug}</span>
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
      <p className="row-sub">{row.ensName}</p>
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
