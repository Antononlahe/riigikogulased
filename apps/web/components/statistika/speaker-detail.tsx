"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { MemberAvatar } from "@/components/member-avatar";
import { PartyBadge } from "@/components/party-badge";
import type { SpeakerRow } from "@/lib/speeches";

function Tile({ label, value, danger }: { label: string; value: number | string; danger?: boolean }) {
  return (
    <div className="rounded-md border border-border p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-serif text-lg font-bold tabular-nums ${danger ? "text-red-700 dark:text-red-500" : ""}`}>
        {value}
      </div>
    </div>
  );
}

/** Member summary shown inline (under the row) or in the split side-panel. Read-only: deeper
 *  detail (full vote timeline) is one click away via "Ava täislehel". */
export function SpeakerDetail({ row, withHeader = false }: { row: SpeakerRow; withHeader?: boolean }) {
  const t = useTranslations("statistika");
  const pct =
    row.counted && row.counted > 0 && row.aligned != null
      ? (row.aligned / row.counted) * 100
      : null;
  return (
    <div className="p-4">
      {withHeader && (
        <div className="mb-3 flex items-center gap-3">
          <MemberAvatar fullName={row.fullName} photoThumbPath={row.photoThumbPath} shortName={row.partyShortName} />
          <div className="min-w-0">
            <div className="truncate font-serif text-base font-bold">{row.fullName}</div>
            <PartyBadge shortName={row.partyShortName} />
          </div>
        </div>
      )}
      <div className="mb-3 flex items-baseline gap-2.5">
        <span className="font-serif text-3xl font-extrabold tabular-nums">
          {pct == null ? "—" : `${pct.toLocaleString("et", { maximumFractionDigits: 1 })}%`}
        </span>
        <span className="text-xs text-muted-foreground">
          {t("disciplineWith")}
          {pct != null && (
            <>
              <br />
              {t("disciplineCount", { aligned: row.aligned ?? 0, counted: row.counted ?? 0 })}
            </>
          )}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Tile label={t("votesCount")} value={row.counted ?? "—"} />
        <Tile label={t("withFaction")} value={row.aligned ?? "—"} />
        <Tile label={t("againstFaction")} value={row.defections ?? "—"} danger />
      </div>
      <h4 className="mb-2 mt-4 font-serif text-sm font-bold">{t("speechesSection")}</h4>
      <div className="grid grid-cols-3 gap-2">
        <Tile label={t("speeches")} value={row.speeches} />
        <Tile label={t("questions")} value={row.questions} />
        <Tile label={t("total")} value={row.total} />
      </div>
      <Link
        href={`/members/${row.slug}`}
        className="mt-4 inline-block text-[13px] font-semibold text-[color:var(--ring)] hover:underline"
      >
        {t("openFull")}
      </Link>
    </div>
  );
}
