"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { MemberAvatar } from "@/components/member-avatar";
import { PartyBadge } from "@/components/party-badge";
import { SpeakerDetail } from "@/components/statistika/speaker-detail";
import { partyToken } from "@/lib/party";
import {
  sortSpeakers,
  speakerMetric,
  compactNumber,
  isNormalizable,
  isRateEligible,
  RATE_FLOOR_DAYS,
  DAYS_PER_MONTH,
  type SpeakerRow,
  type SpeakerSortKey,
  type SpeakerMode,
  type SortDir,
} from "@/lib/speeches";

// Metric columns (everything except the "tenure" context column) -- all are numeric SpeakerRow keys.
type MetricKey = Exclude<SpeakerSortKey, "tenure">;
const COLS: MetricKey[] = [
  "speeches",
  "questions",
  "procedural",
  "total",
  "totalWords",
  "avgWords",
];
const COLSPAN = 2 + COLS.length; // name + tenure + metrics

type View = "split" | "inline";

const SplitIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <rect x="3" y="4" width="18" height="16" rx="2" /><line x1="14" y1="4" x2="14" y2="20" />
  </svg>
);
const InlineIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

export function SpeakerLeaderboard({ rows }: { rows: SpeakerRow[] }) {
  const t = useTranslations("statistika");
  const [sortKey, setSortKey] = useState<SpeakerSortKey>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [mode, setMode] = useState<SpeakerMode>("abs");
  const [view, setView] = useState<View>("split");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  // Split needs two columns side by side -- no room on phones, so force inline there (and hide
  // the view toggle). matchMedia runs after mount, so SSR renders the split default.
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const effectiveView: View = isNarrow ? "inline" : view;

  const visible = useMemo(
    () => sortSpeakers(rows, sortKey, sortDir, mode),
    [rows, sortKey, sortDir, mode],
  );
  // Scale bars to the busiest member; in rate mode ignore flagged (sub-floor) rows so their
  // noisy rate doesn't squash everyone else.
  const max = useMemo(() => {
    const pool =
      mode === "rate" && isNormalizable(sortKey) ? visible.filter(isRateEligible) : visible;
    return Math.max(1, ...pool.map((r) => speakerMetric(r, sortKey, mode)));
  }, [visible, sortKey, mode]);

  // Split panel always shows something: the selected row, or the top row as a default.
  const selected = visible.find((r) => r.memberId === selectedId) ?? visible[0];

  function choose(key: SpeakerSortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function onRowClick(id: number) {
    if (effectiveView === "split") setSelectedId(id);
    else setExpandedId((cur) => (cur === id ? null : id));
  }

  function cellText(r: SpeakerRow, c: MetricKey): string {
    const v = speakerMetric(r, c, mode);
    if (mode === "rate" && isNormalizable(c)) {
      return c === "totalWords" ? compactNumber(Math.round(v)) : v.toLocaleString("et", { maximumFractionDigits: 1 });
    }
    return c === "totalWords" || c === "avgWords" ? compactNumber(r[c]) : String(r[c]);
  }

  const months = (r: SpeakerRow) =>
    r.daysInTerm != null ? Math.max(1, Math.round(r.daysInTerm / DAYS_PER_MONTH)) : null;

  const table = (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {t("member")}
            </th>
            <th className="border-r border-border px-3 py-2 text-right" aria-sort={sortKey === "tenure" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
              <button
                onClick={() => choose("tenure")}
                className={`text-[11px] font-bold uppercase tracking-wide hover:text-foreground ${sortKey === "tenure" ? "text-foreground" : "text-muted-foreground"}`}
              >
                {t("tenure")} {sortKey === "tenure" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </button>
            </th>
            {COLS.map((c) => (
              <th key={c} className={`min-w-[4.75rem] px-3 py-2 text-right ${c === "total" ? "border-r border-border" : ""}`} aria-sort={sortKey === c ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                <button
                  onClick={() => choose(c)}
                  className={`text-[11px] font-bold uppercase tracking-wide hover:text-foreground ${sortKey === c ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {t(c)} {sortKey === c ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => {
            const token = partyToken(r.partyShortName);
            const m = months(r);
            const isNew = r.daysInTerm != null && r.daysInTerm < RATE_FLOOR_DAYS;
            const isSelected = effectiveView === "split" && selected?.memberId === r.memberId;
            const isExpanded = effectiveView === "inline" && expandedId === r.memberId;
            return (
              <Fragment key={r.memberId}>
                <tr
                  onClick={() => onRowClick(r.memberId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowClick(r.memberId);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={effectiveView === "inline" ? isExpanded : undefined}
                  className={`cursor-pointer border-b border-border last:border-0 hover:bg-secondary focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-ring ${r.active ? "" : "opacity-55"} ${isSelected ? "bg-secondary shadow-[inset_3px_0_0_var(--ring)]" : ""}`}
                >
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-3 font-semibold">
                      <MemberAvatar fullName={r.fullName} photoThumbPath={r.photoThumbPath} shortName={r.partyShortName} />
                      <span className="hover:underline">{r.fullName}</span>
                      <PartyBadge shortName={r.partyShortName} />
                      {(r.boardRole === "ESIMEES" || r.boardRole === "ASEESIMEES") && (
                        <span
                          title={t("boardNote")}
                          className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          {t(r.boardRole === "ESIMEES" ? "boardChair" : "boardDeputy")}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="border-r border-border px-3 py-2 text-right tabular-nums">
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <span className={sortKey === "tenure" ? "font-bold" : "text-muted-foreground"}>
                        {m != null ? m : "—"}
                      </span>
                      {isNew && (
                        <span
                          title={t("tenureNewNote")}
                          className="rounded-full border border-amber-300 bg-amber-50 px-1.5 text-[10px] font-medium text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-500"
                        >
                          {t("tenureNew")}
                        </span>
                      )}
                    </span>
                  </td>
                  {COLS.map((c) => {
                    const flagged = mode === "rate" && isNormalizable(c) && !isRateEligible(r);
                    const shown = cellText(r, c);
                    const active = sortKey === c;
                    // In-cell bar: a low-opacity fill anchored to the right, BEHIND the value, only
                    // on the sorted column. Out of flow (absolute), so the number never moves when
                    // you re-sort -- and the low opacity keeps the number readable on top.
                    const pct = active && !flagged ? (speakerMetric(r, c, mode) / max) * 100 : 0;
                    const divider = c === "total" ? "border-r border-border" : "";
                    return (
                      <td key={c} className={`relative px-3 py-2 text-right tabular-nums ${divider}`}>
                        {active && !flagged && (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-y-1 right-0 rounded-sm"
                            style={{ width: `${pct}%`, backgroundColor: token.fill, opacity: 0.2 }}
                          />
                        )}
                        <span
                          className={`relative ${flagged ? "cursor-help text-amber-700/90 dark:text-amber-500/90" : active ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                          title={flagged ? t("tenureFlagNote") : undefined}
                        >
                          {shown}
                          {flagged && <span aria-hidden>∗</span>}
                        </span>
                      </td>
                    );
                  })}
                </tr>
                {isExpanded && (
                  <tr className="border-b border-border bg-card">
                    <td colSpan={COLSPAN} className="p-0">
                      <div className="sticky left-0 w-[min(44rem,92vw)]">
                        <SpeakerDetail row={r} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-md border border-border text-[13px] font-semibold">
          {(["abs", "rate"] as SpeakerMode[]).map((md) => (
            <button
              key={md}
              onClick={() => setMode(md)}
              className={`px-3 py-1.5 ${mode === md ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"}`}
            >
              {t(md === "abs" ? "modeAbsolute" : "modeRate")}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {t(mode === "abs" ? "modeAbsoluteHint" : "modeRateHint")}
        </span>
        {!isNarrow && (
          <div className="ml-auto inline-flex overflow-hidden rounded-md border border-border">
            {([["split", SplitIcon], ["inline", InlineIcon]] as const).map(([v, Icon]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-pressed={view === v}
                aria-label={t(v === "split" ? "viewSplit" : "viewInline")}
                title={t(v === "split" ? "viewSplit" : "viewInline")}
                className={`p-2 ${view === v ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"}`}
              >
                <Icon />
              </button>
            ))}
          </div>
        )}
      </div>

      {effectiveView === "split" ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_20rem]">
          {table}
          <aside className="h-max rounded-md border border-border bg-card md:sticky md:top-4">
            {selected && <SpeakerDetail row={selected} withHeader />}
          </aside>
        </div>
      ) : (
        table
      )}

      {mode === "rate" && (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="text-amber-700 dark:text-amber-500">∗</span> {t("tenureFlagNote")}
        </p>
      )}
    </div>
  );
}
