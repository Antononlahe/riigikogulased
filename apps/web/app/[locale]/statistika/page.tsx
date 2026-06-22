// v0.5 statistics page (REMOVABLE FEATURE). Speaker leaderboard (v0.5-A). The committee
// cohesion sections were removed (2026-06-22): the metric proxied plenary discipline because
// the API exposes no per-committee roll-call votes, which read as misleading. Remove the page
// by deleting the app/[locale]/statistika tree, the statistika components, speeches* lib
// modules, migration 0011, and the nav link in site-header.
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SpeakerLeaderboard } from "@/components/statistika/speaker-leaderboard";
import { getSpeechLeaderboard } from "@/lib/speeches-queries";
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

  let speakers: SpeakerRow[] = [];
  try {
    speakers = await getSpeechLeaderboard();
  } catch {
    // leave empty; section renders its own empty state
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-serif text-2xl font-bold tracking-tight">{t("heading")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("intro")}</p>

        <section className="mt-10">
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
