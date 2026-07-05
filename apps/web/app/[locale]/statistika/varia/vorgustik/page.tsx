import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FriendshipByCountry, Globetrotters, CauseCaucuses } from "@/components/varia/network";
import { getFriendshipGroups, getGlobetrotters, getCauseCaucuses } from "@/lib/varia-queries";
import type { CaucusRow, Globetrotter } from "@/lib/varia";

export const revalidate = 86400;

export default async function NetworkPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("varia");

  let friendship: CaucusRow[] = [], globetrotters: Globetrotter[] = [], causes: CaucusRow[] = [];
  try {
    [friendship, globetrotters, causes] = await Promise.all([
      getFriendshipGroups(), getGlobetrotters(), getCauseCaucuses(),
    ]);
  } catch {
    /* empty state until member_caucuses is populated */
  }

  const empty = friendship.length === 0 && causes.length === 0;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-serif text-2xl font-bold tracking-tight">{t("vorgustikTitle")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("vorgustikIntro")}</p>
        {empty ? (
          <p className="mt-6 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="mt-8">
            {friendship.length > 0 && <FriendshipByCountry groups={friendship} />}
            {globetrotters.length > 0 && <Globetrotters rows={globetrotters} />}
            {causes.length > 0 && <CauseCaucuses causes={causes} />}
          </div>
        )}
        <SiteFooter />
      </main>
    </>
  );
}
