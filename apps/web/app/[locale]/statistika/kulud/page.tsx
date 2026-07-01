// Expense compensations, latest year (default). Static -- no searchParams. Other years live at
// /statistika/kulud/[aasta]. See ../page.tsx for the removable-feature note.
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { StatistikaTabs } from "@/components/statistika/statistika-tabs";
import { ExpensesSection } from "@/components/statistika/expenses-section";
import { getExpenseYears } from "@/lib/expenses-queries";

export const revalidate = 3600;

export default async function ExpensesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("statistika");
  const footer = await getTranslations("footer");
  const years = await getExpenseYears();
  const latest = years[0] ?? 0;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-serif text-2xl font-bold tracking-tight">{t("heading")}</h1>
        <StatistikaTabs active="kulud" />
        <ExpensesSection year={latest} />
        <footer className="mt-12 border-t border-border pt-4 text-xs text-muted-foreground">
          <p>{footer("source")}</p>
        </footer>
      </main>
    </>
  );
}
