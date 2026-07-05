import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Generations } from "@/components/varia/generations";
import { getMembersWithAge } from "@/lib/varia-queries";
import type { GenRow } from "@/lib/varia";

export const revalidate = 86400;

export default async function GenerationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("varia");

  let rows: GenRow[] = [];
  try {
    rows = await getMembersWithAge();
  } catch {
    /* empty state */
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-serif text-2xl font-bold tracking-tight">{t("generationsTitle")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("generationsIntro")}</p>
        <div className="mt-6">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <Generations rows={rows} />
          )}
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
