import { getTranslations } from "next-intl/server";
import { getFactionComparison } from "@/lib/factions-queries";
import { sortFactions, type FactionSortKey } from "@/lib/factions";
import { FactionBars } from "@/components/factions/faction-bars";

// Metrics that have a home page. "members" is dropped -- it had no obvious page.
type BarMetric = Exclude<FactionSortKey, "members">;

const TITLE_KEY: Record<BarMetric, string> = {
  cohesion: "barsCohesion",
  attendance: "barsAttendance",
  expenses: "barsExpenses",
};

/**
 * Per-faction comparative bars for one metric, sorted best-first. This is the leftover of
 * the removed /fraktsioonid page: the same FactionBars, one metric per host page (cohesion
 * on the home page, attendance on kohalolek, expenses on kulud). Renders nothing on no data.
 */
export async function FactionMetricBars({ metric }: { metric: BarMetric }) {
  let rows;
  try {
    rows = await getFactionComparison();
  } catch {
    return null;
  }
  if (rows.length === 0) return null;

  const t = await getTranslations("factions");
  const sorted = sortFactions(rows, metric, "desc");
  return (
    <section className="mt-10">
      <h2 className="mb-4 font-serif text-lg font-bold">{t(TITLE_KEY[metric])}</h2>
      <FactionBars rows={sorted} sortKey={metric} />
    </section>
  );
}
