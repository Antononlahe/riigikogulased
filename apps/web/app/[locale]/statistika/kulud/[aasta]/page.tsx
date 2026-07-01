// Expense compensations for a specific year. Prerendered per year (generateStaticParams +
// dynamicParams=false), so year switching is a CDN hit. See ../../page.tsx for the removable note.
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { StatistikaTabs } from "@/components/statistika/statistika-tabs";
import { ExpensesSection } from "@/components/statistika/expenses-section";
import { getExpenseYears } from "@/lib/expenses-queries";

export const revalidate = 3600;
export const dynamicParams = false;

export async function generateStaticParams() {
  const years = await getExpenseYears();
  return years.map((y) => ({ aasta: String(y) }));
}

export default async function ExpensesYearPage({
  params,
}: {
  params: Promise<{ locale: string; aasta: string }>;
}) {
  const { locale, aasta } = await params;
  setRequestLocale(locale);
  const year = Number(aasta);
  if (!Number.isInteger(year) || year <= 0) notFound();
  const t = await getTranslations("statistika");
  const footer = await getTranslations("footer");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-serif text-2xl font-bold tracking-tight">{t("heading")}</h1>
        <StatistikaTabs active="kulud" />
        <ExpensesSection year={year} />
        <footer className="mt-12 border-t border-border pt-4 text-xs text-muted-foreground">
          <p>{footer("source")}</p>
        </footer>
      </main>
    </>
  );
}
