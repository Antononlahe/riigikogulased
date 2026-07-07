import { getTranslations } from "next-intl/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";
import { MemberSearch } from "@/components/member-search";
import { Link } from "@/i18n/routing";
import { getMemberIndex, type MemberIndexRow } from "@/lib/queries";

export async function SiteHeader() {
  const site = await getTranslations("site");
  const nav = await getTranslations("nav");
  let memberIndex: MemberIndexRow[] = [];
  try {
    memberIndex = await getMemberIndex();
  } catch {
    // DB down -> search box simply hidden
  }
  return (
    <header className="border-b-2 border-foreground">
      {/* flex-wrap: on narrow screens the nav drops to a second line instead of overflowing
          (no horizontal scroll). Four headings; the Statistika dropdown absorbs the rest. */}
      <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-y-2 px-4 py-5">
        <Link href="/" className="font-serif text-2xl font-bold tracking-tight hover:opacity-80">
          {site("title")}
        </Link>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {/* Five flat citizen-facing headings; no dropdown to hide behind. */}
          <Link href="/saadikud" className="hover:text-foreground">{nav("members")}</Link>
          <Link href="/statistika/otsustavad" className="hover:text-foreground">{nav("decisive")}</Link>
          <Link href="/statistika/sonavotud" className="hover:text-foreground">{nav("speeches")}</Link>
          <Link href="/statistika/kulud" className="hover:text-foreground">{nav("expenses")}</Link>
          <Link href="/statistika/varia" className="hover:text-foreground">{nav("varia")}</Link>
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          {memberIndex.length > 0 && (
            <MemberSearch
              items={memberIndex}
              placeholder={nav("searchPlaceholder")}
              noResults={nav("searchNoResults")}
              labels={{
                members: nav("searchGroupMembers"),
                speeches: nav("searchGroupSpeeches"),
                allSpeeches: nav("searchAllSpeeches"),
              }}
            />
          )}
          <LocaleToggle />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
