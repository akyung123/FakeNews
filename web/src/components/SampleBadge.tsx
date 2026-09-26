import { isMockMode } from "../lib/mode";

/** Visible only while the UI is reading the in-browser seed. */
export function SampleBadge() {
  if (!isMockMode()) return null;
  return <span className="sample-badge">Sample data</span>;
}
