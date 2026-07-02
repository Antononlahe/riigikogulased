// Decisive votes: did a vote against the fraktsioon line ever flip an outcome?
// Static (no searchParams; the "almost" toggle is client-side). See ../page.tsx for the
// statistika removable-feature note; this route additionally uses migration 0022 and
// lib/decisive-queries.ts.
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DecisiveVotes } from "@/components/statistika/decisive-votes";
import {
  getCloseVotes,
  getDecisiveVotes,
  getDefectionVoteCount,
  type DecisiveVote,
} from "@/lib/decisive-queries";

export const revalidate = 86400; // daily; data refreshes once/day via the scraper cron

export default async function DecisiveVotesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("decisive");

  let decisive: DecisiveVote[] = [];
  let close: DecisiveVote[] = [];
  let defectionVoteCount = 0;
  try {
    [decisive, close, defectionVoteCount] = await Promise.all([
      getDecisiveVotes(),
      getCloseVotes(),
      getDefectionVoteCount(),
    ]);
  } catch {
    /* empty state */
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-serif text-2xl font-bold tracking-tight">{t("heading")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("intro")}</p>
        <div className="mt-6">
          <DecisiveVotes
            decisive={decisive}
            close={close}
            defectionVoteCount={defectionVoteCount}
          />
        </div>
        <p className="mt-6 max-w-2xl text-xs text-muted-foreground">{t("methodNote")}</p>
        <SiteFooter />
      </main>
    </>
  );
}
