import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Network } from "@/components/varia/network";
import { getFriendshipMembers, getCauseMembers } from "@/lib/varia-queries";
import type { CaucusMember } from "@/lib/varia";

export const revalidate = 86400;

export default async function NetworkPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("varia");

  let friendship: CaucusMember[] = [], causes: CaucusMember[] = [];
  try {
    [friendship, causes] = await Promise.all([getFriendshipMembers(), getCauseMembers()]);
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
            <Network friendship={friendship} causes={causes} />
          </div>
        )}
        <SiteFooter />
      </main>
    </>
  );
}
