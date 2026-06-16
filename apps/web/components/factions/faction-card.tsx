import { useTranslations } from "next-intl";
import { partyToken } from "@/lib/party";
import { Link } from "@/i18n/routing";
import { factionSlug, cohesion, attendanceRate, type FactionComparisonRow } from "@/lib/factions";

function pct(v: number | null): string {
  return v === null ? "—" : `${(Math.round(v * 1000) / 10).toFixed(1)}%`;
}

export function FactionCard({ row }: { row: FactionComparisonRow }) {
  const t = useTranslations("factions");
  const token = partyToken(row.partyShortName);
  const coh = cohesion(row.alignedVotes, row.countedVotes);
  const att = attendanceRate(row.presentBallots, row.totalBallots);
  return (
    <Link
      href={`/fraktsioonid/${factionSlug(row.partyShortName)}`}
      className="block rounded-md border border-border p-4 transition-colors hover:bg-secondary"
    >
      <div className="flex items-baseline justify-between">
        <span className="font-serif text-lg font-bold" style={{ color: token.ink }}>
          {row.partyShortName}
        </span>
        <span className="text-xs text-muted-foreground">
          {row.memberCount} {t("members")}
        </span>
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-wide text-muted-foreground">
        {t("cohesion")}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-[7px] flex-1 overflow-hidden rounded bg-muted" aria-hidden>
          <div className="h-full rounded" style={{ width: `${(coh ?? 0) * 100}%`, background: token.fill }} />
        </div>
        <span className="w-14 text-right text-sm font-semibold tabular-nums">{pct(coh)}</span>
      </div>
      <div className="mt-3 flex justify-between text-xs text-muted-foreground">
        <span>{t("attendance")}: <span className="tabular-nums text-foreground">{pct(att)}</span></span>
        <span>{t("defections")}: <span className="tabular-nums text-foreground">{row.defections}</span></span>
      </div>
    </Link>
  );
}
