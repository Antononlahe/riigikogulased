import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getMemberDetail } from "@/lib/queries";
import { pool } from "@/lib/db";
import { SiteHeader } from "@/components/site-header";
import { MemberHeader } from "@/components/member/member-header";
import { DisciplineSummary } from "@/components/member/discipline-summary";
import { PartyBreakdown } from "@/components/member/party-breakdown";
import { AffiliationsPanel } from "@/components/member/affiliations-panel";
import { MemberVotes } from "@/components/member/member-votes";

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const { rows } = await pool.query<{ slug: string }>("SELECT slug FROM members");
    return rows.map((r) => ({ slug: r.slug }));
  } catch {
    return [];
  }
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

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <MemberHeader member={d.member} />
        <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{t("cycle")}</p>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_18rem]">
          <div className="space-y-8">
            <DisciplineSummary
              counted={d.counted}
              aligned={d.aligned}
              defections={d.defections}
              partyShortName={d.member.partyShortName}
            />
            <MemberVotes votes={d.votes} voteResults={d.voteResults} />
            <PartyBreakdown rows={d.breakdown} />
          </div>
          <AffiliationsPanel
            member={d.member}
            committees={d.committees}
            districts={d.districts}
          />
        </div>
      </main>
    </>
  );
}
