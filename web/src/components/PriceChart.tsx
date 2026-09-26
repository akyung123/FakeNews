/**
 * Live price chart for a coin.
 *
 * Points come from the v4 pool once the market is open, and from the local
 * trade history before that. Price only: no percent change (INTERFACE_CCA §0).
 */
import { useId, useMemo, useState } from "react";

export type ChartPoint = { at: number; value: number };

export type PriceChartProps = {
  points: readonly ChartPoint[];
  /** Shown above the plot, e.g. `Pool price` or `Curve price`. */
  label: string;
  /** Draws the pulsing head and the Live tag. */
  live?: boolean;
  /** Formats a y value for the axis and the readout. */
  format: (value: number) => string;
  height?: number;
  emptyText?: string;
};

const WIDTH = 600;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 18;

function niceTime(at: number): string {
  const d = new Date(at * 1000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function PriceChart({
  points,
  label,
  live = false,
  format,
  height = 160,
  emptyText = "No trades yet.",
}: PriceChartProps) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const plot = useMemo(() => {
    if (points.length < 2) return null;
    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || Math.abs(max) || 1;
    const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
    const innerH = height - PAD_TOP - PAD_BOTTOM;
    const xy = points.map((p, i) => ({
      x: PAD_LEFT + (i / (points.length - 1)) * innerW,
      y: PAD_TOP + innerH - ((p.value - min) / span) * innerH,
      point: p,
    }));
    const line = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
    const area = `${line} L${xy[xy.length - 1].x.toFixed(2)},${height - PAD_BOTTOM} L${xy[0].x.toFixed(2)},${height - PAD_BOTTOM} Z`;
    return { xy, line, area, min, max };
  }, [points, height]);

  const latest = points[points.length - 1];
  const shown = hover !== null && plot ? plot.xy[hover].point : latest;

  if (!plot) {
    return (
      <section className="chart chart-empty">
        <div className="chart-head">
          <span className="faint small">{label}</span>
        </div>
        <p className="faint small">{emptyText}</p>
      </section>
    );
  }

  return (
    <section className="chart">
      <div className="chart-head">
        <span className="faint small">{label}</span>
        {live ? (
          <span className="chart-live">
            <span className="chart-dot" aria-hidden="true" />
            Live
          </span>
        ) : null}
      </div>

      <div className="chart-readout">
        <span className="chart-value mono">{format(shown.value)}</span>
        <span className="faint small mono">{niceTime(shown.at)}</span>
      </div>

      <svg
        className="chart-svg"
        viewBox={`0 0 ${WIDTH} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label} over time`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          if (box.width === 0) return;
          const ratio = (event.clientX - box.left) / box.width;
          const index = Math.round(ratio * (points.length - 1));
          setHover(Math.min(points.length - 1, Math.max(0, index)));
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="chart-fill-top" />
            <stop offset="100%" className="chart-fill-bottom" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((ratio) => {
          const y = PAD_TOP + ratio * (height - PAD_TOP - PAD_BOTTOM);
          return (
            <line
              key={ratio}
              className="chart-grid"
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={y}
              y2={y}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        <path d={plot.area} fill={`url(#${gradientId})`} />
        <path className="chart-line" d={plot.line} fill="none" vectorEffect="non-scaling-stroke" />

        {hover !== null ? (
          <line
            className="chart-cursor"
            x1={plot.xy[hover].x}
            x2={plot.xy[hover].x}
            y1={PAD_TOP}
            y2={height - PAD_BOTTOM}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        <circle
          className={`chart-head-dot${live ? " pulsing" : ""}`}
          cx={plot.xy[plot.xy.length - 1].x}
          cy={plot.xy[plot.xy.length - 1].y}
          r="3"
        />
      </svg>

      <div className="chart-axis">
        <span className="faint small mono">{niceTime(points[0].at)}</span>
        <span className="faint small mono">{format(plot.max)}</span>
      </div>
    </section>
  );
}
