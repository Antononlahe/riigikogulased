"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { PartyBadge } from "@/components/party-badge";
import type { MemberIndexRow } from "@/lib/queries";

// Fold diacritics so "olluk" matches "Õlluk" etc.
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const MAX_RESULTS = 8;

// Header member search: a small combobox over the full member list (~120 rows, shipped inline),
// navigating straight to the member page.
export function MemberSearch({
  items,
  placeholder,
  noResults,
}: {
  items: MemberIndexRow[];
  placeholder: string;
  noResults: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const needle = fold(q.trim());
    if (!needle) return [];
    return items.filter((m) => fold(m.fullName).includes(needle)).slice(0, MAX_RESULTS);
  }, [q, items]);

  const go = (slug: string) => {
    setQ("");
    setOpen(false);
    router.push(`/saadik/${slug}`);
  };

  return (
    <div ref={rootRef} className="relative" onBlur={(e) => {
      if (!rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
    }}>
      <input
        type="search"
        value={q}
        placeholder={placeholder}
        role="combobox"
        aria-controls="member-search-listbox"
        aria-expanded={open && q.trim().length > 0}
        aria-label={placeholder}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            go(results[active].slug);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="h-7 w-28 rounded border border-border bg-background px-2 text-sm outline-none transition-[width] placeholder:text-muted-foreground focus:w-44 focus:border-foreground sm:w-36"
      />
      {open && q.trim() && (
        <ul
          id="member-search-listbox"
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1 max-h-80 w-64 overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {results.length === 0 && (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">{noResults}</li>
          )}
          {results.map((m, i) => (
            <li key={m.slug} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(m.slug)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm ${
                  i === active ? "bg-accent text-accent-foreground" : ""
                }`}
              >
                <span className={`truncate ${m.active ? "text-foreground" : "text-muted-foreground"}`}>
                  {m.fullName}
                </span>
                {m.partyShortName && <PartyBadge shortName={m.partyShortName} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
