import { getTranslations, setRequestLocale } from "next-intl/server";
import { getMemberDiscipline, type MemberDisciplineRow } from "@/lib/queries";
import { getElectedNonSitting, type NonSittingCandidate } from "@/lib/election-queries";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MembersTable } from "@/components/members-table";
import { NonSitting } from "@/components/election/non-sitting";
import { FactionMetricBars } from "@/components/factions/faction-metric-bars";

export const revalidate = 86400; // daily; data refreshes once/day via the scraper cron

// The party-discipline table -- the site's flagship metric. Was the home page until the front
// door became the stats hub (/); the "biggest rebel" hub card and the nav both link here.
export default async function DisciplinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("members");

  let rows: MemberDisciplineRow[] = [];
  let dbError: string | null = null;
  try {
    rows = await getMemberDiscipline();
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  let nonSitting: NonSittingCandidate[] = [];
  try {
    nonSitting = await getElectedNonSitting();
  } catch {
    // table not yet present / empty -> section is simply hidden
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section>
          <h1 className="font-serif text-2xl font-bold tracking-tight">{t("heading")}</h1>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("cycle")}</p>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("subheading")}</p>

          <FactionMetricBars metric="cohesion" />

          {dbError ? (
            <p className="mt-6 rounded border border-destructive/40 bg-destructive/5 p-4 text-sm">
              {t("empty")}
              <br />
              <span className="font-mono text-xs">{dbError}</span>
            </p>
          ) : rows.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="mt-6">
              <MembersTable rows={rows} />
            </div>
          )}
        </section>

        {nonSitting.length > 0 && <NonSitting rows={nonSitting} />}

        <SiteFooter />
      </main>
    </>
  );
}
