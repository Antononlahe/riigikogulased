import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { FactionRoster } from "@/components/factions/faction-roster";
import { getCommitteeDetail } from "@/lib/committees-queries";
import { committeeSlug, cohesion } from "@/lib/committees";
import { pool } from "@/lib/db";

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const { rows } = await pool.query<{ name: string }>("SELECT name FROM committees");
    return rows.map((r) => ({ slug: committeeSlug(r.name) }));
  } catch {
    return [];
  }
}

function pct(v: number | null): string {
  return v === null ? "—" : `${(Math.round(v * 1000) / 10).toFixed(1)}%`;
}

export default async function CommitteeDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("statistika");

  let detail = null;
  try {
    detail = await getCommitteeDetail(slug);
  } catch {
    detail = null;
  }
  if (!detail) notFound();

  const coh = cohesion(detail.aligned, detail.counted);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-serif text-2xl font-bold tracking-tight">{detail.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("cohesion")}:{" "}
          <span className="font-semibold tabular-nums text-foreground">{pct(coh)}</span>
          {" · "}
          {t("members")}:{" "}
          <span className="font-semibold tabular-nums text-foreground">{detail.memberCount}</span>
          {" · "}
          {t("counted")}:{" "}
          <span className="font-semibold tabular-nums text-foreground">{detail.counted}</span>
          {" · "}
          {t("defections")}:{" "}
          <span className="font-semibold tabular-nums text-foreground">{detail.defections}</span>
        </p>
        <p className="mt-2 max-w-2xl text-xs text-muted-foreground">{t("rollupNote")}</p>
        <div className="mt-8">
          <FactionRoster members={detail.members} />
        </div>
      </main>
    </>
  );
}
