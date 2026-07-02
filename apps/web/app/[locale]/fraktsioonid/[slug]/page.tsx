import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getFactionDetail } from "@/lib/factions-queries";
import { partyFromSlug, factionSlug, cohesion, attendanceRate } from "@/lib/factions";
import { PARTY_ORDER } from "@/lib/party";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FactionRoster } from "@/components/factions/faction-roster";

export const revalidate = 86400; // daily; data refreshes once/day via the scraper cron
export const dynamicParams = false;

export async function generateStaticParams() {
  return PARTY_ORDER.map((p) => ({ slug: factionSlug(p) }));
}

function pct(v: number | null): string {
  return v === null ? "—" : `${(Math.round(v * 1000) / 10).toFixed(1)}%`;
}

export default async function FactionDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("factions");

  const short = partyFromSlug(slug);
  if (!short) notFound();

  let detail = null;
  try {
    detail = await getFactionDetail(short);
  } catch {
    detail = null;
  }
  if (!detail) notFound();

  const coh = cohesion(detail.alignedVotes, detail.countedVotes);
  const att = attendanceRate(detail.presentBallots, detail.totalBallots);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-serif text-2xl font-bold tracking-tight">{detail.partyName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("cohesion")}: <span className="font-semibold text-foreground tabular-nums">{pct(coh)}</span>
          {" · "}
          {t("members")}: <span className="font-semibold text-foreground tabular-nums">{detail.memberCount}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("totals", { counted: detail.countedVotes, defections: detail.defections, attendance: pct(att) })}
        </p>
        <div className="mt-8">
          <FactionRoster members={detail.members} />
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
