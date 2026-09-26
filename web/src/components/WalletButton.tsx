import { useState } from "react";
import { sepolia } from "wagmi/chains";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { ensureSepoliaChain } from "../lib/cca/sepolia";
import { isCcaDemoMode } from "../lib/mode";

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletButton() {
  const demo = isCcaDemoMode();
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [switching, setSwitching] = useState(false);
  const onSepolia = chainId === sepolia.id;
  const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];

  async function switchToSepolia() {
    setSwitching(true);
    try {
      await ensureSepoliaChain();
    } finally {
      setSwitching(false);
    }
  }

  if (!isConnected || !address) {
    return (
      <div className="wallet-box">
        <p className="faint small">Wallet</p>
        <button
          type="button"
          className="btn primary full"
          disabled={!injected || isPending}
          onClick={() => injected && connect({ connector: injected })}
        >
          {isPending ? "Connecting…" : "Connect wallet"}
        </button>
        {demo ? <p className="faint small">Sepolia. Demo cash below still works.</p> : null}
        {demo ? <p className="faint small">Contracts not connected yet.</p> : null}
      </div>
    );
  }

  return (
    <div className="wallet-box">
      <p className="faint small">Wallet</p>
      <p className="strong">{shortAddress(address)}</p>
      {onSepolia ? (
        <p className="faint small">Ethereum Sepolia</p>
      ) : (
        <button
          type="button"
          className="btn primary full"
          disabled={switching}
          onClick={() => void switchToSepolia()}
        >
          {switching ? "Switching…" : "Switch to Sepolia"}
        </button>
      )}
      {demo ? <p className="faint small">Contracts not connected yet.</p> : null}
      <button type="button" className="link" onClick={() => disconnect()}>
        Disconnect
      </button>
    </div>
  );
}
