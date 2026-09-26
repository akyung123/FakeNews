import { useState } from "react";
import type { Address } from "viem";
import { watchAsset as wagmiWatchAsset } from "wagmi/actions";
import { etherscanToken, etherscanTx, shortHex } from "../lib/explorer";
import { wagmiConfig } from "../lib/wagmi";
import { CopyButton } from "./CopyButton";

export type WatchAssetInput = { address: Address; symbol: string; decimals: number };

/** wallet_watchAsset through wagmi. Resolves false when the wallet declines. */
export async function addTokenToWallet(input: WatchAssetInput): Promise<boolean> {
  return wagmiWatchAsset(wagmiConfig, { type: "ERC20", options: input });
}

/** The token's own address, clearly labelled, so nobody copies a tx hash by mistake. */
export function TokenAddress({
  address,
  symbol,
  watchAsset = addTokenToWallet,
}: {
  address: Address;
  /** On-chain symbol: the slug upper-cased, at most 11 characters. */
  symbol: string;
  watchAsset?: (input: WatchAssetInput) => Promise<boolean>;
}) {
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="token-address" data-testid="token-address">
      <span className="faint small">Token address</span>
      <code title={address}>{shortHex(address)}</code>
      <CopyButton value={address} label="Copy token address" />
      <a className="link small" href={etherscanToken(address)} target="_blank" rel="noreferrer">
        Etherscan
      </a>
      <button
        type="button"
        className="link small"
        onClick={() => {
          setNote(null);
          void watchAsset({ address, symbol: symbol.slice(0, 11), decimals: 18 })
            .then((added) => setNote(added ? "Added to your wallet" : null))
            .catch(() => setNote("Your wallet couldn't add this token."));
        }}
      >
        Add to MetaMask
      </button>
      {note ? <span className="faint small">{note}</span> : null}
    </div>
  );
}

/** A transaction, labelled, with its Etherscan link. Never shown bare where an address could be expected. */
export function TxLink({ hash, label }: { hash: string; label: string }) {
  return (
    <span className="tx-link small">
      {label}{" "}
      <a className="mono" href={etherscanTx(hash)} target="_blank" rel="noreferrer" title={hash}>
        {shortHex(hash, 6, 4)}
      </a>
    </span>
  );
}
