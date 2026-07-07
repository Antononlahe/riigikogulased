// Speeches: site-wide speech search + speakers leaderboard. Static route (no searchParams on
// the server -- the search box is a client component that reads ?q= itself), so the page stays
// statically rendered / CDN-cached.
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SpeakerLeaderboard } from "@/components/statistika/speaker-leaderboard";
import { SpeechSearch } from "@/components/speech-search";
import { getSpeechLeaderboard } from "@/lib/speeches-queries";
import type { SpeakerRow } from "@/lib/speeches";

export const revalidate = 86400; // daily; data refreshes once/day via the scraper cron

export default async function StatisticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("statistika");

  let speakers: SpeakerRow[] = [];
  try {
    speakers = await getSpeechLeaderboard();
  } catch {
    /* empty state */
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-serif text-2xl font-bold tracking-tight">{t("speakersHeading")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("speakersIntro")}</p>
        {/* Site-wide speech search: who has said what, across every member's stenograms. */}
        <section className="mt-6">
          <h2 className="font-serif text-lg font-bold">{t("searchHeading")}</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{t("searchIntro")}</p>
          <SpeechSearch />
        </section>
        <h2 className="mt-10 font-serif text-lg font-bold">{t("boardHeading")}</h2>
        <div className="mt-3">
          {speakers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <SpeakerLeaderboard rows={speakers} />
          )}
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
