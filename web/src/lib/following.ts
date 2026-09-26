/**
 * Prophets this browser follows. Kept in localStorage only: following is a
 * reading list for one person on one device, not something written on chain.
 *
 * Stored as a JSON array of prophet labels (`ringo`, not `ringo.prophecy.eth`).
 * Anything that is not a clean array of strings reads as an empty list.
 */
import { useMemo, useSyncExternalStore } from "react";

export const FOLLOWING_KEY = "prophecy.following.v1";

/** Fired on window after follow / unfollow so every screen in this tab updates. */
export const FOLLOWING_EVENT = "prophecy:following";

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function cleanLabel(label: string): string {
  return label.trim().toLowerCase();
}

function parse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const out: string[] = [];
    for (const item of value) {
      if (typeof item !== "string") continue;
      const label = cleanLabel(item);
      if (label && !out.includes(label)) out.push(label);
    }
    return out;
  } catch {
    return [];
  }
}

export function getFollowing(): string[] {
  try {
    return parse(storage()?.getItem(FOLLOWING_KEY) ?? null);
  } catch {
    return [];
  }
}

export function isFollowing(label: string): boolean {
  const key = cleanLabel(label);
  return Boolean(key) && getFollowing().includes(key);
}

function write(next: string[]): void {
  try {
    storage()?.setItem(FOLLOWING_KEY, JSON.stringify(next));
  } catch {
    // storage blocked: nothing to keep
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(FOLLOWING_EVENT));
}

/** Newest follow goes first. Following twice is a no-op. */
export function follow(label: string): string[] {
  const key = cleanLabel(label);
  const current = getFollowing();
  if (!key || current.includes(key)) return current;
  const next = [key, ...current];
  write(next);
  return next;
}

export function unfollow(label: string): string[] {
  const key = cleanLabel(label);
  const current = getFollowing();
  if (!current.includes(key)) return current;
  const next = current.filter((item) => item !== key);
  write(next);
  return next;
}

/** Same-tab updates via FOLLOWING_EVENT, other tabs via the storage event. */
export function subscribeFollowing(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === FOLLOWING_KEY) listener();
  };
  window.addEventListener(FOLLOWING_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(FOLLOWING_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

function snapshot(): string {
  try {
    return storage()?.getItem(FOLLOWING_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Followed labels, re-rendered whenever the list changes. */
export function useFollowing(): string[] {
  const raw = useSyncExternalStore(subscribeFollowing, snapshot, () => "");
  return useMemo(() => parse(raw || null), [raw]);
}
