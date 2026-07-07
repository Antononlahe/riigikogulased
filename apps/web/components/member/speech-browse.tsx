"use client";

// Member-page speech BROWSE list. Collapsed by default; on first
// open it fetches /api/speeches (no `q` -> browse mode). Sort + year + sitting-type
// filters refetch from page 0; "load more" pages by offset. Search (SpeechSearch) is the
// find path; this is the scroll-everything path.
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { SpeechBrowseItem } from "@/lib/speeches";

const PAGE = 30;

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}.${m}.${y}` : iso.slice(0, 10);
}

// Render sitting-type filter options in a stable, known order, keeping only those present.
const TYPE_ORDER = ["istung", "infotund", "erakorraline", "taiendav", "eri"];

export function SpeechBrowse({
  memberId,
  total,
  years,
  types,
}: {
  memberId: number;
  total: number;
  years: number[];
  types: string[];
}) {
  const t = useTranslations("memberDetail");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SpeechBrowseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sort, setSort] = useState("recent");
  const [year, setYear] = useState("");
  const [type, setType] = useState("");
  const reqId = useRef(0);

  const load = useCallback(
    async (offset: number) => {
      setLoading(true);
      const id = ++reqId.current;
      const p = new URLSearchParams({ memberId: String(memberId), sort, offset: String(offset) });
      if (year) p.set("year", year);
      if (type) p.set("type", type);
      try {
        const res = await fetch(`/api/speeches?${p}`);
        const data = (await res.json()) as { items: SpeechBrowseItem[] };
        if (id !== reqId.current) return;
        setItems((prev) => (offset === 0 ? data.items : [...prev, ...data.items]));
        setHasMore(data.items.length === PAGE);
      } catch {
        if (id === reqId.current) setHasMore(false);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [memberId, sort, year, type],
  );

  // Refetch from the top whenever a filter changes (only while open).
  useEffect(() => {
    if (open) load(0);
  }, [open, load]);

  const orderedTypes = TYPE_ORDER.filter((x) => types.includes(x));

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-md border border-border bg-card px-3 py-2.5 text-left font-serif text-sm font-bold hover:bg-secondary"
      >
        <span>
          {t("browseShowAll")} <span className="font-sans font-normal text-muted-foreground">{total}</span>
        </span>
        <span className="font-sans text-xs font-normal text-ring">{open ? t("browseHide") : t("browseExpand")}</span>
      </button>

      {open && (
        <div className="mt-2 overflow-hidden rounded-md border border-border">
          <div className="flex flex-wrap gap-2 border-b border-border p-2.5">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label={t("sortLabel")}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
            >
              <option value="recent">{t("sortRecent")}</option>
              <option value="oldest">{t("sortOldest")}</option>
              <option value="longest">{t("sortLongest")}</option>
            </select>
            {years.length > 1 && (
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                aria-label={t("filterYear")}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
              >
                <option value="">{t("yearAll")}</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            )}
            {orderedTypes.length > 1 && (
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                aria-label={t("filterType")}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
              >
                <option value="">{t("typeAllSittings")}</option>
                {orderedTypes.map((x) => (
                  <option key={x} value={x}>
                    {t(`speechType.${x}` as "speechType.istung")}
                  </option>
                ))}
              </select>
            )}
          </div>

          <ul className="max-h-[24rem] divide-y divide-border overflow-y-auto">
            {items.map((it) => {
              const isInfo = it.sittingType === "infotund";
              return (
                <li key={it.speechKey} className="min-w-0 px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      <span className="shrink-0 rounded-sm bg-secondary px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                        {t(`speechType.${it.sittingType ?? "istung"}` as "speechType.istung")}
                      </span>
                      <span className="truncate">
                        {isInfo && it.agendaTitle ? `${t("questionLabel")}: „${it.agendaTitle}"` : it.agendaTitle}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">{formatDate(it.sittingDate)}</span>
                  </div>
                  <p className="mt-1 break-words text-sm leading-snug">
                    {it.opening}
                    {it.opening.length >= 240 ? "…" : ""}
                  </p>
                  <div className="mt-1 flex items-baseline gap-3 text-xs">
                    <span className="text-muted-foreground tabular-nums">
                      {t("wordsUnit", { n: it.wordCount })}
                    </span>
                    {it.link && (
                      <a
                        href={it.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ring hover:underline"
                      >
                        {t("openSteno")}
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
            {!loading && items.length === 0 && (
              <li className="px-3 py-4 text-sm text-muted-foreground">{t("browseEmpty")}</li>
            )}
          </ul>

          {(hasMore || loading) && (
            <div className="border-t border-border p-2.5 text-center">
              {loading ? (
                <span className="text-xs text-muted-foreground">{t("searchLoading")}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => load(items.length)}
                  className="text-xs text-ring hover:underline"
                >
                  {t("loadMore")}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
