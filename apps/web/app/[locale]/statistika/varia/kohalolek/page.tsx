import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AbsenceLeaderboard } from "@/components/varia/absence-leaderboard";
import { FactionMetricBars } from "@/components/factions/faction-metric-bars";
import { getAbsenceLeaderboard } from "@/lib/varia-queries";
import type { AbsenceRow } from "@/lib/varia";

export const revalidate = 86400; // daily; data refreshes once/day via the scraper cron

export default async function AbsencePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("varia");

  let rows: AbsenceRow[] = [];
  try {
    rows = await getAbsenceLeaderboard();
  } catch {
    /* empty state */
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Breadcrumbs items={[{ label: t("hubTitle"), href: "/statistika/varia" }, { label: t("absenceTitle") }]} />
        <h1 className="font-serif text-2xl font-bold tracking-tight">{t("absenceTitle")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("absenceIntro")}</p>
        <FactionMetricBars metric="attendance" />
        <div className="mt-6">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <AbsenceLeaderboard rows={rows} />
          )}
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
