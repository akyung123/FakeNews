/** Bonding-curve progress. `labelled` adds the percentage and graduation note under the bar. */
export function Bar({ value, labelled }: { value: number; labelled?: boolean }) {
  const pctText = `${(value * 100).toFixed(0)}%`;
  return (
    <div className="bar-wrap">
      <div
        className="bar"
        role="meter"
        aria-label="Bonding curve"
        aria-valuenow={Math.round(value * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="bar-fill" style={{ width: `${(value * 100).toFixed(1)}%` }} />
      </div>
      {labelled ? (
        <p className="bar-label">
          <span>Bonding curve {pctText}</span>
          <span className="faint">Graduates at 100%</span>
        </p>
      ) : null}
    </div>
  );
}
