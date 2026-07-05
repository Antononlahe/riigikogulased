// Expense compensations, latest year (default). Static -- no searchParams. Other years live at
// /statistika/kulud/[aasta]. See ../page.tsx for the removable-feature note.
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ExpensesSection } from "@/components/statistika/expenses-section";
import { FactionMetricBars } from "@/components/factions/faction-metric-bars";
import { getExpenseYears } from "@/lib/expenses-queries";

export const revalidate = 86400; // daily; data refreshes once/day via the scraper cron

export default async function ExpensesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const years = await getExpenseYears();
  const latest = years[0] ?? 0;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <FactionMetricBars metric="expenses" />
        <ExpensesSection year={latest} />
        <SiteFooter />
      </main>
    </>
  );
}
