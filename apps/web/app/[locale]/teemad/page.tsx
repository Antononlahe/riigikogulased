import { getTranslations, setRequestLocale } from "next-intl/server";
import { getTopicIndex, type TopicIndexRow } from "@/lib/topics-queries";
import { INDEX_MIN_VOTES } from "@/lib/topics";
import { SiteHeader } from "@/components/site-header";
import { TopicIndexList } from "@/components/topics/topic-index-list";

export const revalidate = 3600;

export default async function TopicsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("topics");
  const footer = await getTranslations("footer");

  let rows: TopicIndexRow[] = [];
  try {
    rows = await getTopicIndex();
  } catch {
    rows = [];
  }
  const topicCount = rows.filter((r) => r.votes >= INDEX_MIN_VOTES).length;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-serif text-2xl font-bold tracking-tight">{t("heading")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("intro")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("coverageNote", { n: topicCount })}</p>
        <div className="mt-6">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <TopicIndexList rows={rows} />
          )}
        </div>
        <footer className="mt-12 border-t border-border pt-4 text-xs text-muted-foreground">
          <p>{footer("source")}</p>
        </footer>
      </main>
    </>
  );
}
