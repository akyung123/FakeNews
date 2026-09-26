import { useSyncExternalStore } from "react";
import { TOTAL_SUPPLY, marketCap, price, quoteBuy, quoteSell, type CurveState } from "./curve";
import { SEED_COINS, SEED_EVENTS } from "./mock";

/**
 * Prototype store: everything lives in this browser (localStorage).
 * Quotes go through curve.ts (SPEC constants). Chain reads come later.
 */

export const YOU = "you";
const START_BALANCE = 0.05;
const STORAGE_KEY = "prophecy:v4";

export type Coin = CurveState & {
  id: string;
  name: string;
  ticker: string;
  prophecy: string;
  creator: string;
  createdAt: number;
  history: { at: number; mcap: number }[];
  /** Token address when known (ENS / Launchpad / live launch). Used to read curve().complete. */
  token?: `0x${string}`;
  /** From Launchpad.curve. Used in chain mode so graduation is not inferred from the prototype sold count. */
  complete?: boolean;
  /** Set when the row came from a Launched log or a live launch receipt. */
  fromChain?: boolean;
};

/** A one-line memo attached to a trade. */
export type Comment = {
  id: string;
  coinId: string;
  user: string;
  text: string;
  at: number;
};

export type Position = { tokens: number; cost: number };

export type State = {
  coins: Coin[];
  comments: Comment[];
  positions: Record<string, Record<string, Position>>;
  balance: number;
};

const newId = () => Math.random().toString(36).slice(2, 10);

function position(state: State, user: string, coinId: string): Position | null {
  const p = state.positions[user]?.[coinId];
  return p && p.tokens > 1e-6 ? p : null;
}

export function entryMcap(p: Position): number {
  return (p.cost / p.tokens) * TOTAL_SUPPLY;
}

// ---- pure state updates (also used by the seed) ----

function applyCreate(state: State, c: Omit<Coin, "sold" | "ethRaised" | "history">): State {
  const coin: Coin = { ...c, sold: 0, ethRaised: 0, history: [] };
  coin.history.push({ at: c.createdAt, mcap: marketCap(coin) });
  return { ...state, coins: [coin, ...state.coins] };
}

function applyBuy(state: State, user: string, coinId: string, ethIn: number, at: number): State {
  const coin = state.coins.find((c) => c.id === coinId);
  if (!coin) return state;
  const q = quoteBuy(coin, ethIn);
  if (q.tokens <= 0) return state;
  const next: Coin = {
    ...coin,
    sold: coin.sold + q.tokens,
    ethRaised: coin.ethRaised + q.ethNet,
  };
  next.history = [...coin.history, { at, mcap: marketCap(next) }];
  const prev = state.positions[user]?.[coinId] ?? { tokens: 0, cost: 0 };
  return {
    ...state,
    coins: state.coins.map((c) => (c.id === coinId ? next : c)),
    positions: {
      ...state.positions,
      [user]: { ...state.positions[user], [coinId]: { tokens: prev.tokens + q.tokens, cost: prev.cost + q.eth } },
    },
    balance: user === YOU ? state.balance - q.eth : state.balance,
  };
}

function applySell(state: State, user: string, coinId: string, tokensIn: number, at: number): State {
  const coin = state.coins.find((c) => c.id === coinId);
  const prev = position(state, user, coinId);
  if (!coin || !prev) return state;
  const tokens = Math.min(tokensIn, prev.tokens);
  const q = quoteSell(coin, tokens);
  if (q.ethOut <= 0) return state;
  const next: Coin = { ...coin, sold: coin.sold - tokens, ethRaised: coin.ethRaised - q.ethOut };
  next.history = [...coin.history, { at, mcap: marketCap(next) }];
  const left = prev.tokens - tokens;
  return {
    ...state,
    coins: state.coins.map((c) => (c.id === coinId ? next : c)),
    positions: {
      ...state.positions,
      [user]: { ...state.positions[user], [coinId]: { tokens: left, cost: prev.cost * (left / prev.tokens) } },
    },
    balance: user === YOU ? state.balance + q.eth : state.balance,
  };
}

function applyComment(state: State, user: string, coinId: string, text: string, at: number): State {
  const p = position(state, user, coinId);
  if (!p || !text.trim()) return state;
  const comment: Comment = { id: newId(), coinId, user, text: text.trim(), at };
  return { ...state, comments: [comment, ...state.comments] };
}

// ---- seed: sample prophecies (records live in mock.ts) ----

function seed(now: number): State {
  let state: State = { coins: [], comments: [], positions: {}, balance: START_BALANCE + 0.0005 };
  const at = (min: number) => now - min * 60_000;
  const timeline = [
    ...SEED_COINS.map((c) => ({ min: c.min, run: (s: State) => applyCreate(s, { ...c, createdAt: at(c.min) }) })),
    ...SEED_EVENTS.map((e) => ({
      min: e.min,
      run: (s: State) => {
        let next = s;
        if ("buy" in e) next = applyBuy(next, e.user, e.coin, e.buy, at(e.min));
        if ("sellShare" in e) {
          const p = position(next, e.user, e.coin);
          if (p) next = applySell(next, e.user, e.coin, p.tokens * e.sellShare, at(e.min));
        }
        if (e.say) next = applyComment(next, e.user, e.coin, e.say, at(e.min));
        return next;
      },
    })),
  ].sort((a, b) => b.min - a.min);
  for (const step of timeline) state = step.run(state);
  return state;
}

// ---- external store ----

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {
    // no storage: fall back to the seed
  }
  return seed(Date.now());
}

let state: State = load();
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage blocked: keep in memory
  }
  for (const l of listeners) l();
}

export function useStore(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

export const actions = {
  create(input: {
    name: string;
    ticker: string;
    prophecy: string;
    firstBuy: number;
    id?: string;
    token?: `0x${string}`;
    fromChain?: boolean;
  }): string {
    const id = input.id ?? newId();
    const now = Date.now();
    let next = applyCreate(state, {
      id,
      name: input.name,
      ticker: input.ticker,
      prophecy: input.prophecy,
      creator: YOU,
      createdAt: now,
      token: input.token,
      fromChain: input.fromChain,
    });
    if (input.firstBuy > 0) next = applyBuy(next, YOU, id, Math.min(input.firstBuy, next.balance), now);
    set(next);
    return id;
  },
  buy(coinId: string, eth: number) {
    set(applyBuy(state, YOU, coinId, Math.min(eth, state.balance), Date.now()));
  },
  sell(coinId: string, tokens: number) {
    set(applySell(state, YOU, coinId, tokens, Date.now()));
  },
  comment(coinId: string, text: string) {
    set(applyComment(state, YOU, coinId, text, Date.now()));
  },
  applyChainSnapshot(input: {
    coinId: string;
    sold: number;
    ethRaised: number;
    balance: number;
    tokensHeld: number;
  }) {
    const coin = state.coins.find((c) => c.id === input.coinId);
    const now = Date.now();
    let next: State = { ...state, balance: input.balance };
    if (coin) {
      const updated: Coin = { ...coin, sold: input.sold, ethRaised: input.ethRaised };
      updated.history = [...coin.history, { at: now, mcap: marketCap(updated) }];
      next = { ...next, coins: state.coins.map((c) => (c.id === input.coinId ? updated : c)) };
    }
    const prev = state.positions[YOU]?.[input.coinId] ?? { tokens: 0, cost: 0 };
    next = {
      ...next,
      positions: {
        ...state.positions,
        [YOU]: {
          ...state.positions[YOU],
          [input.coinId]: { tokens: input.tokensHeld, cost: prev.cost },
        },
      },
    };
    set(next);
  },
  reset() {
    set(seed(Date.now()));
  },
};

// ---- selectors ----

export function myPosition(s: State, coinId: string): Position | null {
  return position(s, YOU, coinId);
}

export function holderCount(s: State, coinId: string): number {
  return Object.values(s.positions).filter((p) => (p[coinId]?.tokens ?? 0) > 1e-6).length;
}

export { marketCap, price };
