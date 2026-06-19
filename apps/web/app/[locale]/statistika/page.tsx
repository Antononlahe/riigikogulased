// v0.4 + v0.5 statistics page (REMOVABLE FEATURE). Committee cohesion (cards A + matrix B)
// and the speaker leaderboard (v0.5-A). Remove by deleting the app/[locale]/statistika tree,
// the statistika components, committees*/speeches* lib modules, migrations 0010/0011, and the
// nav link in site-header. Nothing else depends on these.
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { CommitteeGrid } from "@/components/statistika/committee-grid";
import { CommitteeMatrix } from "@/components/statistika/committee-matrix";
import { SpeakerLeaderboard } from "@/components/statistika/speaker-leaderboard";
import { getCommitteeComparison, getCommitteeMatrix } from "@/lib/committees-queries";
import { getSpeechLeaderboard } from "@/lib/speeches-queries";
import type { CommitteeRow } from "@/lib/committees";
import type { CommitteeMatrix as Matrix } from "@/lib/committees-queries";
import type { SpeakerRow } from "@/lib/speeches";

export const revalidate = 3600;

export default async function StatisticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("statistika");
  const footer = await getTranslations("footer");

  let committees: CommitteeRow[] = [];
  let matrix: Matrix = { committees: [], parties: [], cells: {} };
  let speakers: SpeakerRow[] = [];
  try {
    [committees, matrix, speakers] = await Promise.all([
      getCommitteeComparison(),
      getCommitteeMatrix(),
      getSpeechLeaderboard(),
    ]);
  } catch {
    // leave empties; sections render their own empty state
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-serif text-2xl font-bold tracking-tight">{t("heading")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("intro")}</p>

        <section className="mt-10">
          <h2 className="font-serif text-xl font-bold">{t("committeesHeading")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("committeesIntro")}</p>
          <div className="mt-5">
            {committees.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <CommitteeGrid rows={committees} />
            )}
          </div>
          {matrix.committees.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 font-serif text-lg font-bold">{t("matrixHeading")}</h3>
              <CommitteeMatrix matrix={matrix} />
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-xl font-bold">{t("speakersHeading")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("speakersIntro")}</p>
          <div className="mt-5">
            {speakers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <SpeakerLeaderboard rows={speakers} />
            )}
          </div>
        </section>

        <footer className="mt-12 border-t border-border pt-4 text-xs text-muted-foreground">
          <p>{footer("source")}</p>
        </footer>
      </main>
    </>
  );
}
