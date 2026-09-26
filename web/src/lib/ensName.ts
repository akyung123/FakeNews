/**
 * Token `name` is the full ENS name (`lingo-2028.ringo.prophecy.eth`).
 * Cards and headers show the first label (slug) as the big text.
 */

export type EnsParts = {
  /** First ENS label, e.g. `lingo-2028`. */
  slug: string;
  /** Full name as given, trimmed. */
  name: string;
  labels: string[];
};

export function ensParts(name: string): EnsParts {
  const trimmed = name.trim();
  const labels = trimmed ? trimmed.split(".").filter((part) => part.length > 0) : [];
  return {
    slug: labels[0] ?? "",
    name: trimmed,
    labels,
  };
}

/** First ENS label. `lingo-2028.ringo.prophecy.eth` → `lingo-2028`. */
export function slugOf(name: string): string {
  return ensParts(name).slug;
}

export function isEnsName(name: string): boolean {
  return ensParts(name).labels.length > 1;
}
