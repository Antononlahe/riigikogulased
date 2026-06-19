"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { MemberAvatar } from "@/components/member-avatar";
import { PartyBadge } from "@/components/party-badge";
import { partyToken } from "@/lib/party";
import {
  sortSpeakers,
  speakerMetric,
  type SpeakerRow,
  type SpeakerSortKey,
  type SortDir,
} from "@/lib/speeches";

const COLS: SpeakerSortKey[] = ["speeches", "questions", "procedural", "total"];

export function SpeakerLeaderboard({ rows }: { rows: SpeakerRow[] }) {
  const t = useTranslations("statistika");
  const [sortKey, setSortKey] = useState<SpeakerSortKey>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const visible = useMemo(() => sortSpeakers(rows, sortKey, sortDir), [rows, sortKey, sortDir]);
  const max = useMemo(
    () => Math.max(1, ...visible.map((r) => speakerMetric(r, sortKey))),
    [visible, sortKey],
  );

  function choose(key: SpeakerSortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {t("member")}
            </th>
            {COLS.map((c) => (
              <th key={c} className="px-3 py-2 text-right" aria-sort={sortKey === c ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                <button
                  onClick={() => choose(c)}
                  className={`text-[11px] font-bold uppercase tracking-wide hover:text-foreground ${sortKey === c ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {t(c)} {sortKey === c ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => {
            const token = partyToken(r.partyShortName);
            return (
              <tr key={r.memberId} className={`border-b border-border last:border-0 hover:bg-secondary ${r.active ? "" : "opacity-55"}`}>
                <td className="px-4 py-2">
                  <span className="flex items-center gap-3 font-semibold">
                    <MemberAvatar fullName={r.fullName} photoThumbPath={r.photoThumbPath} shortName={r.partyShortName} />
                    <Link href={`/members/${r.slug}`} className="hover:underline">
                      {r.fullName}
                    </Link>
                    <PartyBadge shortName={r.partyShortName} />
                  </span>
                </td>
                {COLS.map((c) => (
                  <td key={c} className="px-3 py-2 text-right tabular-nums">
                    {sortKey === c ? (
                      <span className="flex items-center justify-end gap-2">
                        <span className="h-[6px] w-20 overflow-hidden rounded bg-muted" aria-hidden>
                          <span
                            className="block h-full rounded"
                            style={{ width: `${(r[c] / max) * 100}%`, background: token.fill }}
                          />
                        </span>
                        <b className="w-12 text-right">{r[c]}</b>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{r[c]}</span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
