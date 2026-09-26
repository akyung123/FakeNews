/** Presentational token name: slug large, full ENS small. No chain reads. */
export function tokenDisplayName(input: {
  slug?: string;
  ensName?: string | null;
  name?: string;
  id?: string;
}): { slug: string; ensName: string | null } {
  if (input.slug && input.ensName) return { slug: input.slug, ensName: input.ensName };
  const name = input.name?.trim() ?? "";
  if (name.endsWith(".eth") && name.includes(".")) {
    return { slug: name.slice(0, name.indexOf(".")), ensName: name };
  }
  return { slug: input.slug ?? input.id ?? name, ensName: input.ensName ?? null };
}

export function TokenName({
  slug,
  ensName,
  copy = false,
}: {
  slug: string;
  ensName?: string | null;
  copy?: boolean;
}) {
  return (
    <span className="token-name">
      <span className="token-slug">{slug}</span>
      {ensName ? (
        <span className="token-ens">
          <span>{ensName}</span>
          {copy ? (
            <button
              type="button"
              className="link token-copy"
              onClick={() => {
                void navigator.clipboard?.writeText(ensName);
              }}
            >
              Copy
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
