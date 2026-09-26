import { useSyncExternalStore } from "react";
import { TOTAL_SUPPLY, marketCap, price, quoteBuy, quoteSell, type CurveState } from "./curve";

/**
 * Prototype store: everything lives in this browser (localStorage).
 * Quotes go through curve.ts (SPEC constants). Chain reads come later.
 */

export const YOU = "you";
const START_BALANCE = 0.05;
const STORAGE_KEY = "prophecy-pump:v3";

export type Coin = CurveState & {
  id: string;
  name: string;
  ticker: string;
  prophecy: string;
  creator: string;
  createdAt: number;
  history: { at: number; mcap: number }[];
};

/** A holder's post. `entryMcap` is their average entry when they posted. */
export type Comment = {
  id: string;
  coinId: string;
  user: string;
  text: string;
  at: number;
  entryMcap: number;
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
  const comment: Comment = { id: newId(), coinId, user, text: text.trim(), at, entryMcap: entryMcap(p) };
  return { ...state, comments: [comment, ...state.comments] };
}

// ---- seed: sample prophecies ----

type SeedEvent =
  | { min: number; coin: string; user: string; buy: number; say?: string }
  | { min: number; coin: string; user: string; sellShare: number; say?: string }
  | { min: number; coin: string; user: string; say: string };

const SEED_COINS = [
  { id: "wifi", ticker: "WIFI", name: "Wifi Dies", prophecy: "The venue Wi-Fi dies at 3am on Saturday", creator: "yuki.eth", min: 180 },
  { id: "oops", ticker: "OOPS", name: "Mainnet Oops", prophecy: "Someone deploys to mainnet by accident before Sunday", creator: "0xHana", min: 140 },
  { id: "coffee", ticker: "COFFEE", name: "No Coffee", prophecy: "Coffee runs out before Sunday breakfast", creator: "tokyo_bob", min: 95 },
  { id: "yolo", ticker: "YOLO", name: "Zero Tests", prophecy: "A team with zero tests ships on time", creator: "degen_kim", min: 60 },
  { id: "why", ticker: "WHY", name: "Why Blockchain", prophecy: "Someone asks “why blockchain?” more than 10 times today", creator: "wagmi_lee", min: 25 },
  { id: "sleep", ticker: "SLEEP", name: "No Sleep", prophecy: "Nobody on our team sleeps before 5am", creator: "moon_park", min: 6 },
];

const SEED_EVENTS: SeedEvent[] = [
  { min: 178, coin: "wifi", user: "yuki.eth", buy: 0.0015, say: "I've met this router before. It's coming." },
  { min: 170, coin: "wifi", user: "tokyo_bob", buy: 0.0025 },
  { min: 150, coin: "wifi", user: "degen_kim", buy: 0.002, say: "LFG 📡" },
  { min: 138, coin: "oops", user: "0xHana", buy: 0.001, say: "trust me, I know my teammates" },
  { min: 120, coin: "wifi", user: "0xHana", buy: 0.001 },
  { min: 110, coin: "oops", user: "satoshi_jr", buy: 0.003, say: "someone always does it" },
  { min: 100, coin: "wifi", user: YOU, buy: 0.0005 },
  { min: 93, coin: "coffee", user: "tokyo_bob", buy: 0.00075 },
  { min: 80, coin: "wifi", user: "tokyo_bob", sellShare: 0.8 },
  { min: 75, coin: "wifi", user: "degen_kim", say: "ugh, why is it dropping AGAIN" },
  { min: 70, coin: "oops", user: "moon_park", buy: 0.0015 },
  { min: 60, coin: "coffee", user: "yuki.eth", buy: 0.001, say: "there is no more coffee…" },
  { min: 58, coin: "yolo", user: "degen_kim", buy: 0.004, say: "tests are for people who doubt" },
  { min: 50, coin: "yolo", user: "wagmi_lee", buy: 0.002 },
  { min: 40, coin: "wifi", user: "wagmi_lee", buy: 0.0005, say: "wifi still up. buying the dip anyway" },
  { min: 35, coin: "yolo", user: "moon_park", buy: 0.003, say: "this is literally us" },
  { min: 30, coin: "oops", user: "satoshi_jr", say: "just saw a PRIVATE_KEY on the big screen 👀" },
  { min: 24, coin: "why", user: "wagmi_lee", buy: 0.0005 },
  { min: 20, coin: "coffee", user: "degen_kim", buy: 0.00025 },
  { min: 18, coin: "why", user: "yuki.eth", buy: 0.00025, say: "count is at 3 already" },
  { min: 15, coin: "yolo", user: "0xHana", buy: 0.0015 },
  { min: 12, coin: "coffee", user: "tokyo_bob", sellShare: 0.6 },
  { min: 10, coin: "coffee", user: "tokyo_bob", say: "they refilled it. I panic sold. classic" },
  { min: 5, coin: "yolo", user: "wagmi_lee", say: "up big and I still haven't written a test" },
  { min: 5, coin: "sleep", user: "moon_park", buy: 0.0001, say: "we're cooked" },
];

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
  create(input: { name: string; ticker: string; prophecy: string; firstBuy: number }): string {
    const id = newId();
    const now = Date.now();
    let next = applyCreate(state, { id, ...input, creator: YOU, createdAt: now });
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

/** Change since launch, as a fraction. */
export function changeSinceLaunch(c: Coin): number {
  const first = c.history[0]?.mcap ?? marketCap(c);
  return marketCap(c) / first - 1;
}

export { marketCap, price };
