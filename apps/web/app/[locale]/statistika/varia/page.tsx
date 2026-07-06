import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { VariaHub, type VariaTile } from "@/components/varia/varia-hub";

export const revalidate = 86400;

export default async function VariaHubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("varia");

  const tiles: VariaTile[] = [
    { href: "/statistika/varia/kohalolek", title: t("tileKohalolek"), desc: t("tileKohalolekDesc") },
    { href: "/statistika/varia/polvkonnad", title: t("tilePolvkonnad"), desc: t("tilePolvkonnadDesc") },
    { href: "/statistika/varia/margusonad", title: t("tileMargusonad"), desc: t("tileMargusonadDesc") },
    { href: "/statistika/varia/inimesed", title: t("tileInimesed"), desc: t("tileInimesedDesc") },
    { href: "/statistika/varia/parlamendiryhmad", title: t("tileVorgustik"), desc: t("tileVorgustikDesc") },
    // Kuluhüvitised + Otsustavad hääled used to live here too; they are now first-class nav
    // headings (Statistika dropdown / top level), so Varia holds only the light stats.
  ];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-serif text-2xl font-bold tracking-tight">{t("hubTitle")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("hubIntro")}</p>
        <div className="mt-6">
          <VariaHub tiles={tiles} />
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
