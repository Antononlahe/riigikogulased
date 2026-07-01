import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getMemberDetail } from "@/lib/queries";
import { SiteHeader } from "@/components/site-header";
import { MemberHeader } from "@/components/member/member-header";
import { DisciplineSummary } from "@/components/member/discipline-summary";
import { PartyBreakdown } from "@/components/member/party-breakdown";
import { AffiliationsPanel } from "@/components/member/affiliations-panel";
import { MemberVotes } from "@/components/member/member-votes";
import { SpeechPanel } from "@/components/member/speech-panel";
import { getMemberSpeechStats } from "@/lib/speeches-queries";
import { ElectionPanel } from "@/components/member/election-panel";
import { getMemberElection } from "@/lib/election-queries";
import { ExpensePanel } from "@/components/member/expense-panel";
import { getMemberExpenses } from "@/lib/expenses-queries";

export const revalidate = 3600;
export const dynamicParams = true;
// ponytail: prerender NO member pages at build (empty list) -- avoids re-reading every member's
// full vote history on each deploy (~200MB Neon egress/deploy). But the presence of
// generateStaticParams + dynamicParams=true still makes each page ISR-cached on-demand (first
// visit per page per hour renders + caches, rest are CDN HITs). Returning [] is the sweet spot:
// zero build egress AND cached pages. (An empty list here, unlike no function at all, keeps the
// route ISR rather than falling back to per-request dynamic rendering.)
export function generateStaticParams(): { slug: string }[] {
  return [];
}

export default async function MemberPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("memberDetail");

  let detail = null;
  try {
    detail = await getMemberDetail(slug);
  } catch {
    detail = null;
  }
  if (!detail) notFound();

  const d = detail;

  // These three panels are independent and each degrades gracefully to empty on failure. Fetch
  // them in parallel (allSettled) so an ISR cache-miss render pays one round-trip instead of three
  // stacked ones -- matching getMemberDetail's own Promise.all fan-out.
  const [speechStatsR, electionR, expensesR] = await Promise.allSettled([
    getMemberSpeechStats(d.member.memberId),
    getMemberElection(d.member.memberId),
    getMemberExpenses(d.member.memberId),
  ]);
  const speechStats = speechStatsR.status === "fulfilled" ? speechStatsR.value : null;
  const election = electionR.status === "fulfilled" ? electionR.value : null;
  const expenses = expensesR.status === "fulfilled" ? expensesR.value : [];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <MemberHeader member={d.member} />
        <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{t("cycle")}</p>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_18rem]">
          <div className="min-w-0 space-y-8">
            <DisciplineSummary
              counted={d.counted}
              aligned={d.aligned}
              defections={d.defections}
              partyShortName={d.member.partyShortName}
            />
            <MemberVotes votes={d.votes} voteResults={d.voteResults} />
            {speechStats && (
              <SpeechPanel
                stats={speechStats}
                memberId={d.member.memberId}
                boardRole={d.member.boardRole}
                mandateStartedOn={d.member.mandateStartedOn}
              />
            )}
            <PartyBreakdown rows={d.breakdown} />
            <ExpensePanel years={expenses} />
          </div>
          <div className="space-y-6">
            {election && (
              <ElectionPanel
                election={election}
                active={d.member.active}
                enteredOn={d.member.mandateStartedOn}
              />
            )}
            <AffiliationsPanel
              member={d.member}
              committees={d.committees}
              districts={d.districts}
            />
          </div>
        </div>
      </main>
    </>
  );
}
