import { useState } from "react";
import { isEnsName, slugOf } from "../lib/ensName";

/** Presentational token name: slug large, full ENS small. No chain reads. */
export function tokenDisplayName(input: {
  slug?: string;
  ensName?: string | null;
  name?: string;
  id?: string;
}): { slug: string; ensName: string | null } {
  if (input.slug && input.ensName) return { slug: input.slug, ensName: input.ensName };
  const name = input.name?.trim() ?? "";
  if (isEnsName(name)) {
    return { slug: slugOf(name), ensName: name };
  }
  const slug = input.slug ?? slugOf(name);
  return { slug: slug || input.id || name, ensName: input.ensName ?? null };
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
          {copy ? <CopyFullName value={ensName} /> : null}
        </span>
      ) : null}
    </span>
  );
}

function CopyFullName({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="link token-copy"
      onClick={() => {
        if (!navigator.clipboard) return;
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
