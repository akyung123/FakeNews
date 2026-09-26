import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FOLLOWING_EVENT,
  FOLLOWING_KEY,
  follow,
  getFollowing,
  isFollowing,
  subscribeFollowing,
  unfollow,
  useFollowing,
} from "./following";

describe("following", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("starts empty", () => {
    expect(getFollowing()).toEqual([]);
    expect(isFollowing("alice")).toBe(false);
  });

  it("follows and unfollows by label, newest first, with no duplicates", () => {
    follow("alice");
    follow("Bob");
    follow("alice");
    expect(getFollowing()).toEqual(["bob", "alice"]);
    expect(JSON.parse(localStorage.getItem(FOLLOWING_KEY) ?? "[]")).toEqual(["bob", "alice"]);
    expect(isFollowing("BOB")).toBe(true);

    unfollow("bob");
    expect(getFollowing()).toEqual(["alice"]);
    expect(isFollowing("bob")).toBe(false);
    unfollow("nobody");
    expect(getFollowing()).toEqual(["alice"]);
  });

  it("reads broken JSON or a non-array as an empty list", () => {
    localStorage.setItem(FOLLOWING_KEY, "{not json");
    expect(getFollowing()).toEqual([]);
    localStorage.setItem(FOLLOWING_KEY, JSON.stringify({ alice: true }));
    expect(getFollowing()).toEqual([]);
    localStorage.setItem(FOLLOWING_KEY, JSON.stringify(["alice", 7, null, "", "alice"]));
    expect(getFollowing()).toEqual(["alice"]);
  });

  it("recovers from broken JSON on the next follow", () => {
    localStorage.setItem(FOLLOWING_KEY, "oops");
    follow("alice");
    expect(getFollowing()).toEqual(["alice"]);
  });

  it("tells same-tab listeners about each change", () => {
    const listener = vi.fn();
    const stop = subscribeFollowing(listener);
    follow("alice");
    unfollow("alice");
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    follow("bob");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("does not fire when nothing changed", () => {
    const listener = vi.fn();
    window.addEventListener(FOLLOWING_EVENT, listener);
    follow("alice");
    follow("alice");
    unfollow("bob");
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(FOLLOWING_EVENT, listener);
  });

  it("useFollowing re-renders on follow and unfollow", () => {
    const { result } = renderHook(() => useFollowing());
    expect(result.current).toEqual([]);
    act(() => {
      follow("alice");
    });
    expect(result.current).toEqual(["alice"]);
    act(() => {
      unfollow("alice");
    });
    expect(result.current).toEqual([]);
  });
});
