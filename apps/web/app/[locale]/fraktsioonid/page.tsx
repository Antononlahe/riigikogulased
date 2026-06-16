import { getTranslations, setRequestLocale } from "next-intl/server";
import { getFactionComparison } from "@/lib/factions-queries";
import { type FactionComparisonRow } from "@/lib/factions";
import { SiteHeader } from "@/components/site-header";
import { FactionGrid } from "@/components/factions/faction-grid";

export const revalidate = 3600;

export default async function FactionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("factions");
  const footer = await getTranslations("footer");

  let rows: FactionComparisonRow[] = [];
  try {
    rows = await getFactionComparison();
  } catch {
    rows = [];
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-serif text-2xl font-bold tracking-tight">{t("heading")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("intro")}</p>
        <div className="mt-6">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <FactionGrid rows={rows} />
          )}
        </div>
        <footer className="mt-12 border-t border-border pt-4 text-xs text-muted-foreground">
          <p>{footer("source")}</p>
        </footer>
      </main>
    </>
  );
}
