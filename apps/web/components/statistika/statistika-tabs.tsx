import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

// Tab bar shared by the two statistika routes (/statistika = speakers, /statistika/kulud =
// expenses). Each page passes its own `active` so the bar is a static server component -- no
// usePathname, no client JS -- which keeps both routes CDN-cacheable (instant tab switches).
export async function StatistikaTabs({ active }: { active: "kone" | "kulud" }) {
  const t = await getTranslations("statistika");
  const cls = (on: boolean) =>
    `px-3 py-1.5 text-[13px] font-semibold ${
      on ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"
    }`;
  return (
    <div className="mt-6 inline-flex overflow-hidden rounded-md border border-border">
      <Link
        href="/statistika"
        aria-current={active === "kone" ? "page" : undefined}
        className={cls(active === "kone")}
      >
        {t("tabSpeakers")}
      </Link>
      <Link
        href="/statistika/kulud"
        aria-current={active === "kulud" ? "page" : undefined}
        className={cls(active === "kulud")}
      >
        {t("tabExpenses")}
      </Link>
    </div>
  );
}
