import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StatCard } from "@/components/stat-card";
import { getStatHighlights, type PersonHighlight } from "@/lib/hub-queries";

export const revalidate = 86400; // daily; data refreshes once/day via the scraper cron

// Front page: a hub of superlative cards, each the top row of a leaderboard, linking to the full
// page behind it. The flagship discipline table lives at /parteidistsipliin.
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("hub");
  const h = await getStatHighlights();

  // A person card: the holder if sole, else "N saadikut" (a tie) linking to the full list.
  const person = (p: PersonHighlight) =>
    p.tied > 1
      ? { href: p.href, name: t("tiedCount", { n: p.tied }) }
      : {
          href: p.href,
          name: p.name,
          party: p.party,
          avatar: { fullName: p.name, photoThumbPath: p.photoThumbPath, shortName: p.party },
        };

  // Each entry is null when its highlight is missing; filtered out below.
  const cards = [
    h.rebel && { eyebrow: t("rebelTitle"), value: t("rebelValue", { pct: h.rebel.value }), ...person(h.rebel) },
    h.talker && { eyebrow: t("talkerTitle"), value: t("talkerValue", { n: h.talker.value }), ...person(h.talker) },
    h.absentee && { eyebrow: t("absenteeTitle"), value: t("absenteeValue", { pct: h.absentee.value }), ...person(h.absentee) },
    h.closestVote && {
      eyebrow: t("closestTitle"),
      value: t("closestValue", { gap: h.closestVote.value }),
      href: h.closestVote.href,
      name: h.closestVote.name,
    },
    h.youngest && { eyebrow: t("youngestTitle"), value: t("youngestValue", { age: h.youngest.value }), ...person(h.youngest) },
    h.mostChildren && { eyebrow: t("childrenTitle"), value: t("childrenValue", { n: h.mostChildren.value }), ...person(h.mostChildren) },
  ].filter((c): c is NonNullable<typeof c> => Boolean(c));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-serif text-2xl font-bold tracking-tight">{t("heading")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("intro")}</p>
        {cards.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c, i) => (
              <StatCard key={i} {...c} />
            ))}
          </div>
        )}
        <SiteFooter />
      </main>
    </>
  );
}
