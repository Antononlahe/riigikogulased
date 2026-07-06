// Expense compensations for a specific year. Prerendered per year (generateStaticParams +
// dynamicParams=false), so year switching is a CDN hit. See ../../page.tsx for the removable note.
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ExpensesSection } from "@/components/statistika/expenses-section";
import { getExpenseYears } from "@/lib/expenses-queries";

export const revalidate = 86400; // daily; data refreshes once/day via the scraper cron
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

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Breadcrumbs items={[{ label: t("expensesHeading"), href: "/statistika/kulud" }, { label: String(year) }]} />
        <ExpensesSection year={year} />
        <SiteFooter />
      </main>
    </>
  );
}
