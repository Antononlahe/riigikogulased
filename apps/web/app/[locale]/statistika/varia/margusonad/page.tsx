import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SignatureWords } from "@/components/varia/signature-words";
import { getPartySignatureWords } from "@/lib/varia-queries";
import type { PartyWords } from "@/lib/varia";

export const revalidate = 86400;

export default async function SignatureWordsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("varia");

  let parties: PartyWords[] = [];
  try {
    parties = await getPartySignatureWords();
  } catch {
    /* empty state (table not yet populated) */
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Breadcrumbs items={[{ label: t("hubTitle"), href: "/statistika/varia" }, { label: t("margusonadTitle") }]} />
        <h1 className="font-serif text-2xl font-bold tracking-tight">{t("margusonadTitle")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("margusonadIntro")}</p>
        <div className="mt-6">
          {parties.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <SignatureWords parties={parties} />
          )}
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
