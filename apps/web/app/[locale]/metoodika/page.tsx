import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const revalidate = 86400;

// Static methodology page: how the discipline metric works, in plain language. The canonical
// technical definition lives in packages/db/migrations/0003_erakond.sql and CLAUDE.md.
export default async function MetoodikaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("metoodika");

  const sections = ["s1", "s2", "s3", "s4", "s5", "s6"] as const;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-serif text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("intro")}</p>
        <div className="mt-8 max-w-2xl space-y-6">
          {sections.map((s) => (
            <section key={s}>
              <h2 className="font-serif text-lg font-bold">{t(`${s}h`)}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t(`${s}p`)}</p>
            </section>
          ))}
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
