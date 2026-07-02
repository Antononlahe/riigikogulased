// v0.5 statistics -- speakers leaderboard (REMOVABLE FEATURE). Split into static routes
// (2026-07-01): this page = speakers, /statistika/kulud[/aasta] = expense compensations. No
// searchParams anywhere, so every route is statically rendered / CDN-cached -> instant tab
// switches. Remove the feature by deleting the app/[locale]/statistika tree, the statistika
// components, speeches*/expenses* lib modules, migrations 0011 + 0020 + 0021, and the nav link.
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
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
        <div className="mt-6">
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
