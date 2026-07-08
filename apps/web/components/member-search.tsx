"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { PartyBadge } from "@/components/party-badge";
import { Snippet } from "@/components/speech-search";
import type { MemberIndexRow } from "@/lib/queries";
import type { SpeechHit } from "@/lib/speech-search";

// Fold diacritics so "olluk" matches "Õlluk" etc.
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const MAX_MEMBERS = 5;
const MAX_SPEECHES = 3;

// Header search: one box answering both "who is X" (member index, client-side) and "who said X"
// (top stenogram hits via /api/speeches, debounced). The last row always deep-links the full
// speech search on /statistika/sonavotud.
export function MemberSearch({
  items,
  placeholder,
  noResults,
  labels,
}: {
  items: MemberIndexRow[];
  placeholder: string;
  noResults: string;
  labels: { members: string; speeches: string; allSpeeches: string };
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [speechHits, setSpeechHits] = useState<SpeechHit[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  const members = useMemo(() => {
    const needle = fold(q.trim());
    if (!needle) return [];
    return items.filter((m) => fold(m.fullName).includes(needle)).slice(0, MAX_MEMBERS);
  }, [q, items]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) {
      setSpeechHits([]);
      return;
    }
    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/speeches?q=${encodeURIComponent(term)}&limit=${MAX_SPEECHES}`);
        const data = (await res.json()) as { hits: SpeechHit[] };
        if (id === reqId.current) setSpeechHits(data.hits ?? []);
      } catch {
        if (id === reqId.current) setSpeechHits([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  // One flat list for keyboard navigation: members, then speech hits, then "all results".
  type Entry =
    | { kind: "member"; m: MemberIndexRow }
    | { kind: "speech"; h: SpeechHit }
    | { kind: "all" };
  const entries: Entry[] = useMemo(() => {
    if (!q.trim()) return [];
    return [
      ...members.map((m) => ({ kind: "member", m }) as Entry),
      ...speechHits.map((h) => ({ kind: "speech", h }) as Entry),
      ...(q.trim().length >= 3 ? [{ kind: "all" } as Entry] : []),
    ];
  }, [q, members, speechHits]);

  const close = () => {
    setQ("");
    setOpen(false);
    setSpeechHits([]);
  };

  const pick = (e: Entry) => {
    if (e.kind === "member") {
      close();
      router.push(`/saadik/${e.m.slug}`);
    } else {
      // Speech hits and "all results" both land on the site search page pre-filled with the
      // query -- bouncing straight to the external stenogram from here was disorienting.
      const term = q.trim();
      close();
      router.push(`/statistika/sonavotud?q=${encodeURIComponent(term)}`);
    }
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
            setActive((a) => Math.min(a + 1, entries.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && entries[active]) {
            e.preventDefault();
            pick(entries[active]);
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
          className="absolute right-0 top-full z-50 mt-1 max-h-96 w-80 overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {entries.length === 0 && (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">{noResults}</li>
          )}
          {members.length > 0 && (
            <li aria-hidden className="px-2 pb-0.5 pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {labels.members}
            </li>
          )}
          {entries.map((e, i) => {
            const activeCls = i === active ? "bg-accent text-accent-foreground" : "";
            if (e.kind === "member") {
              return (
                <li key={`m-${e.m.slug}`} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => pick(e)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm ${activeCls}`}
                  >
                    <span className={`truncate ${e.m.active ? "text-foreground" : "text-muted-foreground"}`}>
                      {e.m.fullName}
                    </span>
                    {e.m.partyShortName && <PartyBadge shortName={e.m.partyShortName} />}
                  </button>
                </li>
              );
            }
            if (e.kind === "speech") {
              const first = i > 0 && entries[i - 1].kind === "member";
              return (
                <li key={`s-${e.h.speechKey}`} role="option" aria-selected={i === active}>
                  {(first || (i === 0 && members.length === 0)) && (
                    <div aria-hidden className="mt-1 border-t border-border px-2 pb-0.5 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {labels.speeches}
                    </div>
                  )}
                  <button
                    type="button"
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => pick(e)}
                    onMouseEnter={() => setActive(i)}
                    className={`w-full rounded px-2 py-1.5 text-left ${activeCls}`}
                  >
                    <span className="block truncate text-sm">{e.h.fullName}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      <Snippet snippet={e.h.snippet} />
                    </span>
                  </button>
                </li>
              );
            }
            return (
              <li key="all" role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => pick(e)}
                  onMouseEnter={() => setActive(i)}
                  className={`mt-1 w-full rounded border-t border-border px-2 py-1.5 text-left text-sm text-ring ${activeCls}`}
                >
                  {labels.allSpeeches}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
