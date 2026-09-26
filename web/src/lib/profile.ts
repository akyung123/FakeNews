/**
 * Chain-mode prophet profile (`/p/:name`).
 *
 * Prophecies come from the Launched list that Home already loads (one shared
 * read). The wallet comes from those logs, or from the name's ENS address
 * record when the prophet has not launched yet. Avatar and description are
 * the prophet name's own ENS text records, read only.
 */
import type { Address } from "viem";
import { getAccount } from "wagmi/actions";
import { ENS_TEXT_AVATAR, ENS_TEXT_DESCRIPTION, getEnsAddress, getEnsText, useLiveEns } from "./ens";
import { webEnv } from "./env";
import { createReadProphetOf } from "./launchpad";
import { loadLaunchedCoins } from "./launched";
import {
  normalizeProphetLabel,
  prophetEnsName,
  prophetPageFromChain,
  prophetProphecies,
  type ProphetPageData,
} from "./prophetData";
import type { Coin } from "./store";
import { wagmiConfig } from "./wagmi";

export type ProfileText = { avatar: string | null; description: string | null };

export type LoadChainProphetOptions = {
  loadCoins?: () => Promise<Coin[]>;
  /** Wallet for a prophet with no launches yet. */
  resolveWallet?: (label: string, ensName: string) => Promise<Address | null>;
  parentName?: string;
};

async function defaultResolveWallet(label: string, ensName: string): Promise<Address | null> {
  if (useLiveEns()) {
    try {
      const address = await getEnsAddress(ensName);
      if (address) return address;
    } catch {
      // fall through to the connected wallet
    }
  }
  // Without a resolver, the connected wallet can still open its own page.
  let wallet: Address | undefined;
  try {
    wallet = getAccount(wagmiConfig).address;
  } catch {
    return null;
  }
  if (!wallet) return null;
  try {
    const onChain = await createReadProphetOf()(wallet);
    return onChain && onChain.toLowerCase() === label ? wallet : null;
  } catch {
    return null;
  }
}

export async function loadChainProphet(
  name: string,
  options: LoadChainProphetOptions = {},
): Promise<ProphetPageData | null> {
  const parentName = options.parentName ?? webEnv.parentName;
  const label = normalizeProphetLabel(name, parentName);
  if (!label) return null;
  const ensName = prophetEnsName(label, parentName);
  let coins: Coin[] = [];
  try {
    coins = await (options.loadCoins ?? (() => loadLaunchedCoins()))();
  } catch {
    coins = [];
  }
  const prophecies = prophetProphecies(label, coins);
  const fromLog = coins.find((c) => c.fromChain && c.creator.toLowerCase() === label && c.prophet)?.prophet;
  const wallet = fromLog ?? (await (options.resolveWallet ?? defaultResolveWallet)(label, ensName));
  if (!wallet) return null;
  return prophetPageFromChain({ label, wallet, claimableFeeWei: 0n, prophecies, parentName });
}

/** avatar + description text records. Missing or unreadable records are null. */
export async function loadProfileText(ensName: string): Promise<ProfileText> {
  const read = async (key: string) => {
    try {
      const text = await getEnsText(ensName, key);
      return text?.trim() ? text.trim() : null;
    } catch {
      return null;
    }
  };
  const [avatar, description] = await Promise.all([read(ENS_TEXT_AVATAR), read(ENS_TEXT_DESCRIPTION)]);
  return { avatar, description };
}
