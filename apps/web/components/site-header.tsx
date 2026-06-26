import { getTranslations } from "next-intl/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";
import { Link } from "@/i18n/routing";

export async function SiteHeader() {
  const site = await getTranslations("site");
  const nav = await getTranslations("nav");
  return (
    <header className="border-b-2 border-foreground">
      <div className="mx-auto flex max-w-5xl items-end justify-between px-4 py-5">
        <Link href="/" className="font-serif text-2xl font-bold tracking-tight hover:opacity-80">
          {site("title")}
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">{nav("members")}</Link>
          <Link href="/statistika" className="hover:text-foreground">{nav("statistics")}</Link>
          <Link href="/fraktsioonid" className="hover:text-foreground">{nav("factions")}</Link>
          <Link href="/teemad" className="hover:text-foreground">{nav("topics")}</Link>
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          <LocaleToggle />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
