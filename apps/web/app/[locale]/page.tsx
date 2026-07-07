import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StatCard, type StatCardRow } from "@/components/stat-card";
import { getStatHighlights, type PersonHighlight } from "@/lib/hub-queries";

export const revalidate = 86400; // daily; data refreshes once/day via the scraper cron

// Front page: a hub of superlative cards, each showing a metric's two extremes (most and least)
// from the leaderboard behind it. The flagship discipline table lives at /saadikud.
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("hub");
  const h = await getStatHighlights();

  // One card row from a highlight: the holder if sole, else "N saadikut" (a tie). The row's
  // href comes from the highlight itself (sole holder -> member page, tie -> leaderboard).
  const row = (
    p: PersonHighlight,
    eyebrow: string,
    value: string,
    sub?: string,
  ): StatCardRow =>
    p.tied > 1
      ? { eyebrow, value, name: t("tiedCount", { n: p.tied }), sub, href: p.href }
      : {
          eyebrow,
          value,
          sub,
          name: p.name,
          party: p.party,
          avatar: { fullName: p.name, photoThumbPath: p.photoThumbPath, shortName: p.party },
          href: p.href,
        };

  // Each entry is null when its highlight is missing; filtered out below. The `second` row is
  // the metric's opposite end (least where the title says most).
  const cards: ({ top: StatCardRow; second?: StatCardRow | null | false } | null | undefined)[] = [
    h.rebel.top && {
      top: row(
        h.rebel.top,
        t("rebelTitle"),
        t("rebelValue", { pct: h.rebel.top.value }),
        h.rebel.top.detail && t("rebelSub", { d: h.rebel.top.detail[0], c: h.rebel.top.detail[1] }),
      ),
      second:
        h.rebel.bottom &&
        row(
          h.rebel.bottom,
          t("loyalTitle"),
          t("rebelValue", { pct: h.rebel.bottom.value }),
          h.rebel.bottom.detail &&
            t("rebelSub", { d: h.rebel.bottom.detail[0], c: h.rebel.bottom.detail[1] }),
        ),
    },
    h.talker.top && {
      top: row(
        h.talker.top,
        t("talkerTitle"),
        t("talkerValue", { n: h.talker.top.value }),
        h.talker.top.detail && t("talkerSub", { n: h.talker.top.detail[0] }),
      ),
      second:
        h.talker.bottom &&
        row(
          h.talker.bottom,
          t("quietTitle"),
          t("talkerValue", { n: h.talker.bottom.value }),
          h.talker.bottom.detail && t("talkerSub", { n: h.talker.bottom.detail[0] }),
        ),
    },
    h.absentee.top && {
      top: row(
        h.absentee.top,
        t("absenteeTitle"),
        t("absenteeValue", { pct: h.absentee.top.value }),
        h.absentee.top.detail &&
          t("absenteeSub", { a: h.absentee.top.detail[0], c: h.absentee.top.detail[1] }),
      ),
      second:
        h.absentee.bottom &&
        row(
          h.absentee.bottom,
          t("presentTitle"),
          t("absenteeValue", { pct: h.absentee.bottom.value }),
          h.absentee.bottom.detail &&
            t("absenteeSub", { a: h.absentee.bottom.detail[0], c: h.absentee.bottom.detail[1] }),
        ),
    },
    h.closestVote && {
      top: {
        eyebrow: t("closestTitle"),
        value: t("closestValue", { gap: h.closestVote.value }),
        sub: t("closestSub"),
        href: h.closestVote.href,
        name: h.closestVote.name,
      },
    },
    h.age.top && {
      top: row(h.age.top, t("youngestTitle"), t("youngestValue", { age: h.age.top.value })),
      second:
        h.age.bottom &&
        row(h.age.bottom, t("oldestTitle"), t("youngestValue", { age: h.age.bottom.value })),
    },
    h.mostChildren && {
      top: row(h.mostChildren, t("childrenTitle"), t("childrenValue", { n: h.mostChildren.value })),
    },
    h.mandate.top && {
      top: row(h.mandate.top, t("magnetTitle"), t("votesValue", { n: h.mandate.top.value })),
      second:
        h.mandate.bottom &&
        row(h.mandate.bottom, t("cheapTitle"), t("votesValue", { n: h.mandate.bottom.value })),
    },
    h.veteran.top && {
      top: row(
        h.veteran.top,
        t("veteranTitle"),
        t("veteranValue", { n: Math.round(h.veteran.top.value / 365.25) }),
      ),
      second:
        h.veteran.bottom &&
        row(
          h.veteran.bottom,
          t("newcomerTitle"),
          // A fresh substitute reads better in days; anyone past a year, in years.
          h.veteran.bottom.value < 365
            ? t("newcomerValue", { n: h.veteran.bottom.value })
            : t("veteranValue", { n: Math.round(h.veteran.bottom.value / 365.25) }),
        ),
    },
    h.signatureWord && {
      top: {
        eyebrow: t("sigTitle"),
        value: t("sigValue", { word: h.signatureWord.word }),
        sub: t("sigSub"),
        name: h.signatureWord.name,
        party: h.signatureWord.party,
        avatar: {
          fullName: h.signatureWord.name,
          photoThumbPath: h.signatureWord.photoThumbPath,
          shortName: h.signatureWord.party,
        },
        href: h.signatureWord.href,
      },
    },
    h.joiner && {
      top: row(h.joiner, t("joinerTitle"), t("joinerValue", { n: h.joiner.value })),
    },
  ];
  const shown = cards.filter((c): c is { top: StatCardRow; second?: StatCardRow | null | false } =>
    Boolean(c),
  );

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-serif text-2xl font-bold tracking-tight">{t("heading")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("intro")}</p>
        {shown.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((c, i) => (
              <StatCard key={i} top={c.top} second={c.second || null} />
            ))}
          </div>
        )}
        <SiteFooter />
      </main>
    </>
  );
}
