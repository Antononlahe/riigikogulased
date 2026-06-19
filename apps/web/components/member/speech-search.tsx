"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { HL_START, HL_END, type SpeechHit } from "@/lib/speech-search";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}.${m}.${y}` : iso.slice(0, 10);
}

// Render a ts_headline snippet: text between HL_START/HL_END goes in <mark>, everything else
// is a plain React text node (so any "<", ">" in the speech is escaped — no XSS).
function Snippet({ snippet }: { snippet: string }) {
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

export function SpeechSearch({ memberId }: { memberId: number }) {
  const t = useTranslations("memberDetail");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SpeechHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/member-speeches?memberId=${memberId}&q=${encodeURIComponent(term)}`,
        );
        const data = (await res.json()) as { hits: SpeechHit[] };
        if (id === reqId.current) setHits(data.hits);
      } catch {
        if (id === reqId.current) setHits([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q, memberId]);

  return (
    <div className="mt-3">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("searchSpeeches")}
        aria-label={t("searchSpeeches")}
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-ring"
      />
      <p className="mt-1 text-xs text-muted-foreground">{t("searchHint")}</p>

      {q.trim().length >= 2 && (
        <div className="mt-3">
          {loading && <p className="text-sm text-muted-foreground">{t("searchLoading")}</p>}
          {!loading && hits && hits.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("searchNoResults")}</p>
          )}
          {!loading && hits && hits.length > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border">
              {hits.map((h) => (
                <li key={h.speechKey} className="px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                    <span className="truncate">{h.agendaTitle}</span>
                    <span className="shrink-0 tabular-nums">{formatDate(h.sittingDate)}</span>
                  </div>
                  <p className="mt-1 text-sm leading-snug">
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
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
