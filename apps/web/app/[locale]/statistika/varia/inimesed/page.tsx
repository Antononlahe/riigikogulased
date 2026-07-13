import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SectionNav } from "@/components/section-nav";
import { Hobbies, Universities, Children } from "@/components/varia/people";
import { BirthplaceMap } from "@/components/varia/birthplace-map";
import {
  getHobbyMembers, getUniversityMembers, getNoUniversityMembers, getChildren, getBirthPins,
} from "@/lib/varia-queries";
import type { PeopleRow, PeopleMember, ChildRow, BirthPin } from "@/lib/varia";

export const revalidate = 86400;

export default async function PeoplePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("varia");

  // allSettled (not all): each section is independent, so one failing query must degrade only its
  // own section, never blank the whole page.
  const [hobbiesR, unisR, noUniR, childrenR, pinsR] = await Promise.allSettled([
    getHobbyMembers(), getUniversityMembers(), getNoUniversityMembers(), getChildren(), getBirthPins(),
  ]);
  const hobbies: PeopleRow[] = hobbiesR.status === "fulfilled" ? hobbiesR.value : [];
  const unis: PeopleRow[] = unisR.status === "fulfilled" ? unisR.value : [];
  const noUni: PeopleMember[] = noUniR.status === "fulfilled" ? noUniR.value : [];
  const children: ChildRow[] = childrenR.status === "fulfilled" ? childrenR.value : [];
  const pins: BirthPin[] = pinsR.status === "fulfilled" ? pinsR.value : [];

  const hasUnis = unis.length > 0 || noUni.length > 0;
  const empty = hobbies.length === 0 && !hasUnis;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Breadcrumbs items={[{ label: t("hubTitle"), href: "/statistika/varia" }, { label: t("inimesedTitle") }]} />
        <h1 className="font-serif text-2xl font-bold tracking-tight">{t("inimesedTitle")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("inimesedIntro")}</p>
        {empty ? (
          <p className="mt-6 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <>
            <SectionNav
              items={[
                ...(pins.length > 0 ? [{ href: "#sunnikohad", label: t("birthplaceH") }] : []),
                ...(children.length > 0 ? [{ href: "#lapsed", label: t("childrenH") }] : []),
                ...(hobbies.length > 0 ? [{ href: "#huvialad", label: t("hobbiesH") }] : []),
                ...(hasUnis ? [{ href: "#ulikoolid", label: t("universitiesH") }] : []),
              ]}
            />
            <div className="mt-8">
              {pins.length > 0 && (
                <section id="sunnikohad" className="mt-10 scroll-mt-20 first:mt-0">
                  <h2 className="font-serif text-xl font-bold tracking-tight">{t("birthplaceH")}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t("birthplaceSub")}</p>
                  <div className="mt-4">
                    <BirthplaceMap pins={pins} />
                  </div>
                </section>
              )}
              {children.length > 0 && <Children rows={children} />}
              {hobbies.length > 0 && <Hobbies rows={hobbies} />}
              {hasUnis && <Universities rows={unis} noUni={noUni} />}
            </div>
          </>
        )}
        <SiteFooter />
      </main>
    </>
  );
}
