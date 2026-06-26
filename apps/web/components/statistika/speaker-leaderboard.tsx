"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { MemberAvatar } from "@/components/member-avatar";
import { PartyBadge } from "@/components/party-badge";
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

export function SpeakerLeaderboard({ rows }: { rows: SpeakerRow[] }) {
  const t = useTranslations("statistika");
  const [sortKey, setSortKey] = useState<SpeakerSortKey>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [mode, setMode] = useState<SpeakerMode>("abs");
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

  function choose(key: SpeakerSortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
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

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-md border border-border text-[13px] font-semibold">
          {(["abs", "rate"] as SpeakerMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 ${mode === m ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"}`}
            >
              {t(m === "abs" ? "modeAbsolute" : "modeRate")}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {t(mode === "abs" ? "modeAbsoluteHint" : "modeRateHint")}
        </span>
      </div>
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
              return (
                <tr key={r.memberId} className={`border-b border-border last:border-0 hover:bg-secondary ${r.active ? "" : "opacity-55"}`}>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-3 font-semibold">
                      <MemberAvatar fullName={r.fullName} photoThumbPath={r.photoThumbPath} shortName={r.partyShortName} />
                      <Link href={`/members/${r.slug}`} className="hover:underline">
                        {r.fullName}
                      </Link>
                      <PartyBadge shortName={r.partyShortName} />
                      {(r.boardRole === "ESIMEES" || r.boardRole === "ASEESIMEES") && (
                        <span
                          title={t("boardNote")}
                          className="cursor-help rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
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
                          className="cursor-help rounded-full border border-amber-300 bg-amber-50 px-1.5 text-[10px] font-medium text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-500"
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
              );
            })}
          </tbody>
        </table>
      </div>
      {mode === "rate" && (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="text-amber-700 dark:text-amber-500">∗</span> {t("tenureFlagNote")}
        </p>
      )}
    </div>
  );
}
