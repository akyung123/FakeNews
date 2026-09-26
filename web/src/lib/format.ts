export function eth(value: number, digits = 3): string {
  return `${value.toFixed(digits)} ETH`;
}

/** Format the current price as an ETH figure. */
export function mcap(value: number): string {
  return `${value < 10 ? value.toFixed(2) : value.toFixed(1)} ETH`;
}

export function pct(change: number): string {
  const v = change * 100;
  const sign = v > 0 ? "+" : "";
  return `${sign}${Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1)}%`;
}

export function trend(change: number): "up" | "down" | "flat" {
  if (change > 0.0005) return "up";
  if (change < -0.0005) return "down";
  return "flat";
}

export function tokens(value: number): string {
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}

export function ago(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
