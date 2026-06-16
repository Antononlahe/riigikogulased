import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale, getLocale } from "next-intl/server";
import { getTopicIndex, getTopicDetail, getTopicBills } from "@/lib/topics-queries";
import { topicLabel, INDEX_MIN_VOTES } from "@/lib/topics";
import { SiteHeader } from "@/components/site-header";
import { TopicDisciplineTable } from "@/components/topics/topic-discipline-table";
import { TopicBills } from "@/components/topics/topic-bills";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const rows = await getTopicIndex();
    return rows.filter((r) => r.votes >= INDEX_MIN_VOTES).map((r) => ({ edid: String(r.edid) }));
  } catch {
    return [];
  }
}

export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ locale: string; edid: string }>;
}) {
  const { locale, edid } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("topics");

  const id = Number(edid);
  if (!Number.isInteger(id)) notFound();

  let detail = null;
  let bills = [] as Awaited<ReturnType<typeof getTopicBills>>;
  try {
    detail = await getTopicDetail(id);
    if (detail) bills = await getTopicBills(id);
  } catch {
    detail = null;
  }
  if (!detail) notFound();

  const loc = await getLocale();
  const name = topicLabel({ nameEt: detail.nameEt, nameEn: detail.nameEn }, loc);
  const field = loc === "en" ? detail.fieldEn : detail.fieldEt;
  const micro = loc === "en" ? detail.microEn : detail.microEt;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-serif text-2xl font-bold tracking-tight">{name}</h1>
        <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
          {field ? `${field}${micro ? ` · ${micro}` : ""}` : t("noBroadField")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("totals", { votes: detail.votes, bills: detail.bills, defections: detail.defections })}
        </p>
        <div className="mt-8 space-y-8">
          <TopicDisciplineTable members={detail.members} />
          <TopicBills bills={bills} />
        </div>
      </main>
    </>
  );
}
