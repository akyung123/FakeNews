import { sepolia } from "wagmi/chains";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { hasLaunchpad } from "../lib/contracts";

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const onSepolia = chainId === sepolia.id;
  const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];

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
        <p className="faint small">Sepolia. Demo cash below still works.</p>
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
          disabled={isSwitching}
          onClick={() => switchChain({ chainId: sepolia.id })}
        >
          {isSwitching ? "Switching…" : "Switch to Sepolia"}
        </button>
      )}
      <p className="faint small">
        {hasLaunchpad() ? "Launchpad address loaded from env." : "Launchpad address not set yet."}
      </p>
      <button type="button" className="link" onClick={() => disconnect()}>
        Disconnect
      </button>
    </div>
  );
}
