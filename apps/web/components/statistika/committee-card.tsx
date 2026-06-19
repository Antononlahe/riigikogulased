import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { cohesion, type CommitteeRow } from "@/lib/committees";

function pct(v: number | null): string {
  return v === null ? "—" : `${(Math.round(v * 1000) / 10).toFixed(1)}%`;
}

export function CommitteeCard({ row }: { row: CommitteeRow }) {
  const t = useTranslations("statistika");
  const coh = cohesion(row.aligned, row.counted);
  return (
    <Link
      href={`/statistika/komisjonid/${row.slug}`}
      className="block rounded-md border border-border p-4 transition-colors hover:bg-secondary"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-serif text-base font-bold leading-tight">{row.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {row.memberCount} {t("members")}
        </span>
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-wide text-muted-foreground">
        {t("cohesion")}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-[7px] flex-1 overflow-hidden rounded bg-muted" aria-hidden>
          <div
            className="h-full rounded bg-foreground"
            style={{ width: `${(coh ?? 0) * 100}%` }}
          />
        </div>
        <span className="w-14 text-right text-sm font-semibold tabular-nums">{pct(coh)}</span>
      </div>
      <div className="mt-3 flex justify-between text-xs text-muted-foreground">
        <span>
          {t("counted")}: <span className="tabular-nums text-foreground">{row.counted}</span>
        </span>
        <span>
          {t("defections")}: <span className="tabular-nums text-foreground">{row.defections}</span>
        </span>
      </div>
    </Link>
  );
}
