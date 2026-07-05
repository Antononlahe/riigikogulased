"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { PartyBadge } from "@/components/party-badge";
import { PARTY_ORDER, type PartyShort } from "@/lib/party";
import { generationOf, GENERATIONS, type GenRow, type Generation } from "@/lib/varia";

// One shared, perceptually-uniform scale for the cohorts (viridis, colourblind-safe). Youngest
// = yellow, oldest = deep purple -- clearly distinct, unlike the old per-party opacity ramp.
const COHORT_COLOR: Record<Generation, string> = {
  "95+": "#fde725",
  "85-94": "#7ad151",
  "75-84": "#22a884",
  "65-74": "#2a788e",
  "55-64": "#414487",
  "-54": "#440154",
};
// Birth-year labels (the raw "-54" read as an age; these are unambiguous).
const COHORT_LABEL: Record<Generation, string> = {
  "95+": "1995+",
  "85-94": "1985–94",
  "75-84": "1975–84",
  "65-74": "1965–74",
  "55-64": "1955–64",
  "-54": "–1954",
};

type PartyAgg = { party: PartyShort; count: number; avgAge: number; cohorts: Record<Generation, number> };

function emptyCohorts(): Record<Generation, number> {
  return { "95+": 0, "85-94": 0, "75-84": 0, "65-74": 0, "55-64": 0, "-54": 0 };
}

export function Generations({ rows }: { rows: GenRow[] }) {
  const t = useTranslations("varia");
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);

  const { byParty, youngest, oldest, avgAge } = useMemo(() => {
    const map = new Map<PartyShort, PartyAgg>();
    for (const p of PARTY_ORDER) map.set(p, { party: p, count: 0, avgAge: 0, cohorts: emptyCohorts() });
    let ageSum = 0;
    for (const r of rows) {
      ageSum += r.age;
      const agg = r.partyShortName ? map.get(r.partyShortName as PartyShort) : undefined;
      if (!agg) continue;
      agg.count += 1;
      agg.avgAge += r.age;
      agg.cohorts[generationOf(r.birthYear)] += 1;
    }
    const byParty = [...map.values()].filter((a) => a.count > 0)
      .map((a) => ({ ...a, avgAge: Math.round(a.avgAge / a.count) }));
    const sorted = [...rows].sort((a, b) => a.age - b.age);
    return {
      byParty,
      youngest: sorted[0] ?? null,
      oldest: sorted[sorted.length - 1] ?? null,
      avgAge: rows.length ? Math.round(ageSum / rows.length) : 0,
    };
  }, [rows]);

  return (
    <div className="relative space-y-8" onMouseLeave={() => setTip(null)}>
      {/* Callouts */}
      <div className="grid grid-cols-3 gap-3">
        <Callout label={t("avgAge")}><span className="text-2xl font-bold tabular-nums">{avgAge}</span></Callout>
        {youngest && (
          <Callout label={t("youngest")}>
            <Link href={`/members/${youngest.slug}`} className="font-semibold hover:underline">{youngest.fullName}</Link>
            <span className="block text-xs text-muted-foreground">{t("yearsOld", { n: youngest.age })}</span>
          </Callout>
        )}
        {oldest && (
          <Callout label={t("oldest")}>
            <Link href={`/members/${oldest.slug}`} className="font-semibold hover:underline">{oldest.fullName}</Link>
            <span className="block text-xs text-muted-foreground">{t("yearsOld", { n: oldest.age })}</span>
          </Callout>
        )}
      </div>

      {/* Legend: youngest (left) -> oldest (right), same colours as the bars. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {GENERATIONS.map((g) => (
          <span key={g} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded-sm" style={{ backgroundColor: COHORT_COLOR[g] }} />
            {COHORT_LABEL[g]}
          </span>
        ))}
      </div>

      {/* Per-party age profile: 100% stacked cohort bars, youngest segment on the left. */}
      <ul className="space-y-3">
        {byParty.map((a) => (
          <li key={a.party} className="flex items-center gap-3">
            <span className="w-16 shrink-0"><PartyBadge shortName={a.party} /></span>
            <span className="flex h-6 flex-1 overflow-hidden rounded-sm">
              {GENERATIONS.map((g) => {
                const n = a.cohorts[g];
                if (!n) return null;
                return (
                  <span
                    key={g}
                    style={{ width: `${(n / a.count) * 100}%`, backgroundColor: COHORT_COLOR[g] }}
                    onMouseMove={(e) =>
                      setTip({ x: e.clientX, y: e.clientY, text: `${a.party} · ${COHORT_LABEL[g]}: ${n}` })}
                    onMouseLeave={() => setTip(null)}
                  />
                );
              })}
            </span>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground" title={t("avgAge")}>
              {a.avgAge}
            </span>
          </li>
        ))}
      </ul>

      {/* Instant cursor tooltip (fixed-positioned; no native-title delay). */}
      {tip && (
        <div
          className="pointer-events-none fixed z-50 rounded bg-foreground px-2 py-1 text-xs font-medium text-background shadow"
          style={{ left: tip.x + 12, top: tip.y + 12 }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}

function Callout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
