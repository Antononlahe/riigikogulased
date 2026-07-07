"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Link } from "@/i18n/routing";
import { PartyBadge } from "@/components/party-badge";
import { HL_START, HL_END, type SpeechHit } from "@/lib/speech-search";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}.${m}.${y}` : iso.slice(0, 10);
}

// Render a ts_headline snippet: text between HL_START/HL_END goes in <mark>, everything else
// is a plain React text node (so any "<", ">" in the speech is escaped — no XSS).
export function Snippet({ snippet }: { snippet: string }) {
  const out: React.ReactNode[] = [];
  let rest = snippet;
  let key = 0;
  while (rest.length > 0) {
    const start = rest.indexOf(HL_START);
    if (start === -1) {
      out.push(<Fragment key={key++}>{rest}</Fragment>);
      break;
    }
    if (start > 0) out.push(<Fragment key={key++}>{rest.slice(0, start)}</Fragment>);
    const afterStart = rest.slice(start + HL_START.length);
    const end = afterStart.indexOf(HL_END);
    if (end === -1) {
      out.push(<Fragment key={key++}>{afterStart}</Fragment>);
      break;
    }
    out.push(
      <mark key={key++} className="rounded-sm bg-amber-200/60 px-0.5 dark:bg-amber-300/25">
        {afterStart.slice(0, end)}
      </mark>,
    );
    rest = afterStart.slice(end + HL_END.length);
  }
  return <>{out}</>;
}

// Full-text search over stenogram speeches. With `memberId` it's the member-page box
// (that member only); without it it searches the whole corpus and shows who spoke.
// Site-wide mode reads an initial `?q=` from the URL so other pages can deep-link a search.
export function SpeechSearch({ memberId }: { memberId?: number }) {
  const t = useTranslations("memberDetail");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SpeechHit[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);
  const global = memberId == null;

  useEffect(() => {
    if (!global) return;
    const initial = new URLSearchParams(window.location.search).get("q");
    if (initial) setQ(initial);
  }, [global]);

  // Fetch one page; offset 0 replaces the list (new search), otherwise appends (load more).
  const fetchPage = async (term: string, offset: number) => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const member = memberId ? `memberId=${memberId}&` : "";
      const res = await fetch(
        `/api/speeches?${member}q=${encodeURIComponent(term)}&offset=${offset}`,
      );
      const data = (await res.json()) as { hits: SpeechHit[]; total: number };
      if (id !== reqId.current) return;
      setHits((prev) => (offset === 0 || !prev ? data.hits : [...prev, ...data.hits]));
      setTotal(data.total ?? 0);
    } catch {
      if (id === reqId.current && offset === 0) setHits([]);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  };

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits(null);
      setTotal(0);
      setLoading(false);
      reqId.current++;
      return;
    }
    const timer = setTimeout(() => fetchPage(term, 0), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, memberId]);

  return (
    <div className="mt-3 min-w-0">
      <div className="relative">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={global ? t("searchSpeechesAll") : t("searchSpeeches")}
          aria-label={global ? t("searchSpeechesAll") : t("searchSpeeches")}
          className="w-full rounded-md border border-border bg-card py-2 pl-3 pr-9 text-sm outline-none focus:border-ring"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label={t("searchClear")}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t("searchHint")}</p>

      {q.trim().length >= 2 && (
        <div className="mt-3">
          {loading && !hits && <p className="text-sm text-muted-foreground">{t("searchLoading")}</p>}
          {!loading && hits && hits.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("searchNoResults")}</p>
          )}
          {hits && hits.length > 0 && (
            <p className="mb-2 text-xs text-muted-foreground">{t("searchTotal", { n: total })}</p>
          )}
          {hits && hits.length > 0 && (
            <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
              {hits.map((h) => {
                const type = h.sittingType ?? "istung";
                const isInfo = type === "infotund";
                return (
                  <li key={h.speechKey} className="min-w-0 px-3 py-2.5">
                    {global && (
                      <div className="mb-0.5 flex items-center gap-2">
                        <Link href={`/saadik/${h.slug}`} className="text-sm font-semibold hover:underline">
                          {h.fullName}
                        </Link>
                        {h.partyShortName && <PartyBadge shortName={h.partyShortName} />}
                      </div>
                    )}
                    <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                      <span className="flex min-w-0 items-baseline gap-1.5">
                        <span className="shrink-0 rounded-sm bg-secondary px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                          {t(`speechType.${type}` as "speechType.istung")}
                        </span>
                        <span className="truncate">
                          {isInfo && h.agendaTitle ? `${t("questionLabel")}: „${h.agendaTitle}"` : h.agendaTitle}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">{formatDate(h.sittingDate)}</span>
                    </div>
                    <p className="mt-1 break-words text-sm leading-snug">
                      <Snippet snippet={h.snippet} />
                    </p>
                    {h.link && (
                      <a
                        href={h.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs text-ring hover:underline"
                      >
                        {t("openSteno")}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {hits && hits.length > 0 && hits.length < total && (
            <button
              type="button"
              disabled={loading}
              onClick={() => fetchPage(q.trim(), hits.length)}
              className="mt-3 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-50"
            >
              {loading ? t("searchLoading") : t("loadMore")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
