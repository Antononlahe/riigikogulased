"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { PartyBadge } from "@/components/party-badge";
import { partyToken, PARTY_ORDER, type PartyShort } from "@/lib/party";
import { generationOf, GENERATIONS, type GenRow, type Generation } from "@/lib/varia";

// Opacity ramp: newest cohort lightest, oldest darkest -- reads as an age gradient in party colour.
const OPACITY: Record<Generation, number> = {
  "95+": 0.35,
  "85-94": 0.48,
  "75-84": 0.62,
  "65-74": 0.76,
  "55-64": 0.9,
  "-54": 1,
};

type PartyAgg = {
  party: PartyShort;
  count: number;
  avgAge: number;
  cohorts: Record<Generation, number>;
};

function emptyCohorts(): Record<Generation, number> {
  return { "95+": 0, "85-94": 0, "75-84": 0, "65-74": 0, "55-64": 0, "-54": 0 };
}

export function Generations({ rows }: { rows: GenRow[] }) {
  const t = useTranslations("varia");

  const { byParty, youngest, oldest, avgAge } = useMemo(() => {
    const map = new Map<PartyShort, PartyAgg>();
    for (const p of PARTY_ORDER) map.set(p, { party: p, count: 0, avgAge: 0, cohorts: emptyCohorts() });
    let ageSum = 0;
    for (const r of rows) {
      ageSum += r.age;
      const p = r.partyShortName as PartyShort | null;
      const agg = p ? map.get(p) : undefined;
      if (!agg) continue;
      agg.count += 1;
      agg.avgAge += r.age;
      agg.cohorts[generationOf(r.birthYear)] += 1;
    }
    const byParty = [...map.values()]
      .filter((a) => a.count > 0)
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
    <div className="space-y-8">
      {/* Callouts */}
      <div className="grid grid-cols-3 gap-3">
        <Callout label={t("avgAge")}>
          <span className="text-2xl font-bold tabular-nums">{avgAge}</span>
        </Callout>
        {youngest && (
          <Callout label={t("youngest")}>
            <Link href={`/members/${youngest.slug}`} className="font-semibold hover:underline">
              {youngest.fullName}
            </Link>
            <span className="block text-xs text-muted-foreground">{t("yearsOld", { n: youngest.age })}</span>
          </Callout>
        )}
        {oldest && (
          <Callout label={t("oldest")}>
            <Link href={`/members/${oldest.slug}`} className="font-semibold hover:underline">
              {oldest.fullName}
            </Link>
            <span className="block text-xs text-muted-foreground">{t("yearsOld", { n: oldest.age })}</span>
          </Callout>
        )}
      </div>

      {/* Cohort legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {GENERATIONS.map((g) => (
          <span key={g} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: "var(--foreground)", opacity: OPACITY[g] }}
            />
            {g}
          </span>
        ))}
      </div>

      {/* Per-party age-profile bars (100% stacked cohorts, coloured in the party token) */}
      <ul className="space-y-3">
        {byParty.map((a) => {
          const token = partyToken(a.party);
          return (
            <li key={a.party} className="flex items-center gap-3">
              <span className="w-16 shrink-0">
                <PartyBadge shortName={a.party} />
              </span>
              <span className="flex h-6 flex-1 overflow-hidden rounded-sm">
                {GENERATIONS.map((g) => {
                  const n = a.cohorts[g];
                  if (!n) return null;
                  const pct = (n / a.count) * 100;
                  return (
                    <span
                      key={g}
                      title={`${g}: ${n}`}
                      style={{ width: `${pct}%`, backgroundColor: token.fill, opacity: OPACITY[g] }}
                    />
                  );
                })}
              </span>
              <span
                className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground"
                title={t("avgAge")}
              >
                {a.avgAge}
              </span>
            </li>
          );
        })}
      </ul>
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
