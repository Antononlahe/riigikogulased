"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { PartyBadge } from "@/components/party-badge";
import { MemberAvatar } from "@/components/member-avatar";
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

type Person = { fullName: string; slug: string; photoThumbPath: string | null; age: number };
type PartyAgg = { party: PartyShort | null; count: number; avgAge: number; cohorts: Record<Generation, Person[]> };

function emptyCohorts(): Record<Generation, Person[]> {
  return { "95+": [], "85-94": [], "75-84": [], "65-74": [], "55-64": [], "-54": [] };
}

// A segment (one party x one cohort) keyed for the open-set. "~" = the no-party bucket.
const segKey = (party: PartyShort | null, g: Generation) => `${party ?? "~"}|${g}`;

export function Generations({ rows }: { rows: GenRow[] }) {
  const t = useTranslations("varia");
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  // Every open segment panel; legend/party/all toggles operate on whole groups of keys.
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  const { byParty, youngest, oldest, avgAge } = useMemo(() => {
    const map = new Map<PartyShort | null, PartyAgg>();
    for (const p of PARTY_ORDER) map.set(p, { party: p, count: 0, avgAge: 0, cohorts: emptyCohorts() });
    map.set(null, { party: null, count: 0, avgAge: 0, cohorts: emptyCohorts() });
    let ageSum = 0;
    for (const r of rows) {
      ageSum += r.age;
      const key = (r.partyShortName as PartyShort | null) ?? null;
      const agg = map.get(key);
      if (!agg) continue;
      agg.count += 1;
      agg.avgAge += r.age;
      agg.cohorts[generationOf(r.birthYear)].push({
        fullName: r.fullName, slug: r.slug, photoThumbPath: r.photoThumbPath, age: r.age,
      });
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

  // All non-empty segment keys, for the group toggles.
  const allKeys = useMemo(
    () =>
      byParty.flatMap((a) =>
        GENERATIONS.filter((g) => a.cohorts[g].length > 0).map((g) => segKey(a.party, g)),
      ),
    [byParty],
  );

  // Toggle a group: if every key in it is already open, close them all; otherwise open them all.
  const toggle = (keys: string[]) =>
    setOpen((prev) => {
      const next = new Set(prev);
      const allOpen = keys.length > 0 && keys.every((k) => next.has(k));
      for (const k of keys) (allOpen ? next.delete(k) : next.add(k));
      return next;
    });
  const cohortKeys = (g: Generation) =>
    byParty.filter((a) => a.cohorts[g].length > 0).map((a) => segKey(a.party, g));
  const partyKeys = (a: PartyAgg) =>
    GENERATIONS.filter((g) => a.cohorts[g].length > 0).map((g) => segKey(a.party, g));

  return (
    <div className="relative space-y-8" onMouseLeave={() => setTip(null)}>
      {/* Callouts */}
      <div className="grid grid-cols-3 gap-3">
        <Callout label={t("avgAge")}><span className="text-2xl font-bold tabular-nums">{avgAge}</span></Callout>
        {youngest && (
          <Callout label={t("youngest")}>
            <Link href={`/saadik/${youngest.slug}`} className="font-semibold hover:underline">{youngest.fullName}</Link>
            <span className="block text-xs text-muted-foreground">{t("yearsOld", { n: youngest.age })}</span>
          </Callout>
        )}
        {oldest && (
          <Callout label={t("oldest")}>
            <Link href={`/saadik/${oldest.slug}`} className="font-semibold hover:underline">{oldest.fullName}</Link>
            <span className="block text-xs text-muted-foreground">{t("yearsOld", { n: oldest.age })}</span>
          </Callout>
        )}
      </div>

      {/* Legend: youngest (left) -> oldest (right), same colours as the bars. Each chip toggles
          that cohort open across every party; the trailing button toggles everything. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {GENERATIONS.map((g) => {
          const keys = cohortKeys(g);
          const active = keys.length > 0 && keys.every((k) => open.has(k));
          return (
            <button
              type="button"
              key={g}
              aria-pressed={active}
              title={t("legendHint")}
              onClick={() => toggle(keys)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5 transition-colors hover:text-foreground ${active ? "bg-accent text-foreground" : ""}`}
            >
              <span aria-hidden className="h-3 w-3 rounded-sm" style={{ backgroundColor: COHORT_COLOR[g] }} />
              {COHORT_LABEL[g]}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(open.size > 0 ? new Set() : new Set(allKeys))}
          className="ml-auto cursor-pointer rounded-sm px-1 py-0.5 font-medium underline-offset-2 hover:text-foreground hover:underline"
        >
          {open.size > 0 ? t("closeAll") : t("openAll")}
        </button>
      </div>

      {/* Per-party age profile: 100% stacked cohort bars, youngest segment on the left. Click a
          segment to reveal the people in that faction + age bracket. */}
      <ul className="space-y-3">
        {byParty.map((a) => {
          const partyLabel = a.party ?? "-";
          const openCohorts = GENERATIONS.filter(
            (g) => a.cohorts[g].length > 0 && open.has(segKey(a.party, g)),
          );
          return (
            <li key={a.party ?? "other"}>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggle(partyKeys(a))}
                  title={t("partyHint")}
                  className="w-16 shrink-0 cursor-pointer text-left"
                >
                  <PartyBadge shortName={a.party} />
                </button>
                <span className="flex h-6 flex-1 overflow-hidden rounded-sm">
                  {GENERATIONS.map((g) => {
                    const n = a.cohorts[g].length;
                    if (!n) return null;
                    const k = segKey(a.party, g);
                    const isOpen = open.has(k);
                    return (
                      <button
                        type="button"
                        key={g}
                        aria-label={`${partyLabel} ${COHORT_LABEL[g]}: ${n}`}
                        className="h-full cursor-pointer transition-[filter] hover:brightness-110"
                        style={{
                          width: `${(n / a.count) * 100}%`,
                          backgroundColor: COHORT_COLOR[g],
                          boxShadow: isOpen ? "inset 0 0 0 2px var(--foreground)" : undefined,
                        }}
                        onClick={() => toggle([k])}
                        onMouseMove={(e) =>
                          setTip({ x: e.clientX, y: e.clientY, text: `${partyLabel} · ${COHORT_LABEL[g]}: ${n}` })}
                        onMouseLeave={() => setTip(null)}
                      />
                    );
                  })}
                </span>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground" title={t("avgAge")}>
                  {a.avgAge}
                </span>
              </div>

              {openCohorts.map((g) => (
                <div key={g} className="ml-16 mt-2 rounded-md border border-border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span aria-hidden className="h-3 w-3 rounded-sm" style={{ backgroundColor: COHORT_COLOR[g] }} />
                    <PartyBadge shortName={a.party} />
                    <span className="text-sm font-semibold">{COHORT_LABEL[g]}</span>
                    <span className="text-sm text-muted-foreground">· {a.cohorts[g].length}</span>
                    <button
                      type="button"
                      onClick={() => toggle([segKey(a.party, g)])}
                      className="ml-auto text-sm text-muted-foreground hover:text-foreground"
                    >
                      {t("close")}
                    </button>
                  </div>
                  <ul className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                    {[...a.cohorts[g]].sort((x, y) => x.age - y.age).map((m) => (
                      <li key={m.slug}>
                        <Link href={`/saadik/${m.slug}`} className="flex items-center gap-2 hover:underline">
                          <MemberAvatar fullName={m.fullName} photoThumbPath={m.photoThumbPath} shortName={a.party} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{m.fullName}</span>
                            <span className="block text-xs text-muted-foreground">{t("yearsOld", { n: m.age })}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </li>
          );
        })}
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
