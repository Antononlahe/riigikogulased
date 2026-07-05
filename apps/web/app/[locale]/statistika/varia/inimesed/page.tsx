import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hobbies, Professions, Universities, Children } from "@/components/varia/people";
import { BirthplaceMap } from "@/components/varia/birthplace-map";
import {
  getHobbyMembers, getProfessionMembers, getUniversityMembers, getChildren, getBirthPins,
} from "@/lib/varia-queries";
import type { PeopleRow, ChildRow, BirthPin } from "@/lib/varia";

export const revalidate = 86400;

export default async function PeoplePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("varia");

  let hobbies: PeopleRow[] = [], professions: PeopleRow[] = [], unis: PeopleRow[] = [];
  let children: ChildRow[] = [], pins: BirthPin[] = [];
  try {
    [hobbies, professions, unis, children, pins] = await Promise.all([
      getHobbyMembers(), getProfessionMembers(), getUniversityMembers(), getChildren(), getBirthPins(),
    ]);
  } catch {
    /* empty state until member_profiles is populated */
  }

  const empty = hobbies.length === 0 && professions.length === 0 && unis.length === 0;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-serif text-2xl font-bold tracking-tight">{t("inimesedTitle")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("inimesedIntro")}</p>
        {empty ? (
          <p className="mt-6 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="mt-8">
            {hobbies.length > 0 && <Hobbies rows={hobbies} />}
            {professions.length > 0 && <Professions rows={professions} />}
            {unis.length > 0 && <Universities rows={unis} />}
            {children.length > 0 && <Children rows={children} />}
            {pins.length > 0 && (
              <section className="mt-10">
                <h2 className="font-serif text-xl font-bold tracking-tight">{t("birthplaceH")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("birthplaceSub")}</p>
                <div className="mt-4">
                  <BirthplaceMap pins={pins} />
                </div>
              </section>
            )}
          </div>
        )}
        <SiteFooter />
      </main>
    </>
  );
}
