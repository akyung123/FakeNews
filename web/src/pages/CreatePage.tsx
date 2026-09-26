import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { actions } from "../lib/store";

export function CreatePage() {
  const navigate = useNavigate();
  const [prophecy, setProphecy] = useState("");
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [firstBuy, setFirstBuy] = useState("0.05");
  const ready = prophecy.trim() && name.trim() && ticker.trim();

  return (
    <main className="narrow stack">
      <h1>Write a prophecy</h1>
      <p className="faint">It launches as a coin right away. The more it comes true, the more it's worth.</p>
      <form
        className="block create"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready) return;
          const id = actions.create({
            prophecy: prophecy.trim(),
            name: name.trim(),
            ticker: ticker.trim().toUpperCase().replace(/^\$/, ""),
            firstBuy: Number(firstBuy) || 0,
          });
          navigate(`/coin/${id}`);
        }}
      >
        <label className="field">
          <span>Prophecy</span>
          <textarea
            rows={3}
            maxLength={140}
            value={prophecy}
            placeholder="The demo breaks 30 seconds before our pitch"
            onChange={(e) => setProphecy(e.target.value)}
          />
          <span className="faint small">{prophecy.length}/140</span>
        </label>
        <div className="row2">
          <label className="field">
            <span>Name</span>
            <input value={name} maxLength={32} placeholder="Demo Curse" onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>Ticker</span>
            <input value={ticker} maxLength={10} placeholder="CURSE" onChange={(e) => setTicker(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Be the first buyer (ETH, optional)</span>
          <input inputMode="decimal" value={firstBuy} onChange={(e) => setFirstBuy(e.target.value)} />
        </label>
        <button type="submit" className="btn primary full" disabled={!ready}>
          Launch prophecy
        </button>
      </form>
    </main>
  );
}
