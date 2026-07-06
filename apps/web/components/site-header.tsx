import { getTranslations } from "next-intl/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";
import { StatistikaMenu } from "@/components/statistika-menu";
import { Link } from "@/i18n/routing";

export async function SiteHeader() {
  const site = await getTranslations("site");
  const nav = await getTranslations("nav");
  // Four visible headings; the two boards that used to hide in Varia (Sõnavõtud, Kuluhüvitised)
  // now live under the Statistika dropdown, and Otsustavad hääled is promoted to its own heading.
  const statsItems = [
    { href: "/statistika", label: nav("speeches") },
    { href: "/statistika/kulud", label: nav("expenses") },
  ];
  return (
    <header className="border-b-2 border-foreground">
      {/* flex-wrap: on narrow screens the nav drops to a second line instead of overflowing
          (no horizontal scroll). Four headings; the Statistika dropdown absorbs the rest. */}
      <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-y-2 px-4 py-5">
        <Link href="/" className="font-serif text-2xl font-bold tracking-tight hover:opacity-80">
          {site("title")}
        </Link>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <Link href="/parteidistsipliin" className="hover:text-foreground">{nav("members")}</Link>
          <Link href="/statistika/otsustavad" className="hover:text-foreground">{nav("decisive")}</Link>
          <StatistikaMenu label={nav("statistika")} items={statsItems} />
          <Link href="/statistika/varia" className="hover:text-foreground">{nav("varia")}</Link>
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          <LocaleToggle />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
