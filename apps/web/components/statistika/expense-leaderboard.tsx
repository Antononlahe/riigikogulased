"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { MemberAvatar } from "@/components/member-avatar";
import { PartyBadge } from "@/components/party-badge";
import { partyToken } from "@/lib/party";
import type { ExpenseLeaderRow } from "@/lib/expenses-queries";

type SortKey = "limit" | "spent" | "unused" | "pct";
type SortDir = "asc" | "desc";

const eur = (n: number) =>
  n.toLocaleString("et", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const metric = (r: ExpenseLeaderRow, k: SortKey): number => {
  if (k === "limit") return r.limit;
  if (k === "spent") return r.spent;
  if (k === "unused") return r.limit - r.spent;
  return r.limit > 0 ? r.spent / r.limit : 0; // pct
};

const COLS: SortKey[] = ["limit", "spent", "unused", "pct"];

export function ExpenseLeaderboard({ rows }: { rows: ExpenseLeaderRow[] }) {
  const t = useTranslations("statistika");
  const [sortKey, setSortKey] = useState<SortKey>("spent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const visible = useMemo(() => {
    const s = [...rows].sort((a, b) => metric(a, sortKey) - metric(b, sortKey));
    return sortDir === "desc" ? s.reverse() : s;
  }, [rows, sortKey, sortDir]);
  const max = useMemo(
    () => Math.max(1, ...visible.map((r) => metric(r, sortKey))),
    [visible, sortKey],
  );

  function choose(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  function cell(r: ExpenseLeaderRow, k: SortKey): string {
    const v = metric(r, k);
    return k === "pct" ? `${Math.round(v * 100)}%` : eur(v);
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
              <th
                key={c}
                className="min-w-[5.5rem] px-3 py-2 text-right"
                aria-sort={sortKey === c ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
              >
                <button
                  onClick={() => choose(c)}
                  className={`text-[11px] font-bold uppercase tracking-wide hover:text-foreground ${sortKey === c ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {t(`col_${c}` as "col_spent")} {sortKey === c ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => {
            const token = partyToken(r.partyShortName);
            return (
              <tr
                key={r.memberId}
                className={`border-b border-border last:border-0 hover:bg-secondary ${r.active ? "" : "opacity-55"}`}
              >
                <td className="px-4 py-2">
                  <span className="flex items-center gap-3 font-semibold">
                    <MemberAvatar
                      fullName={r.fullName}
                      photoThumbPath={r.photoThumbPath}
                      shortName={r.partyShortName}
                    />
                    <Link href={`/members/${r.slug}`} className="hover:underline">
                      {r.fullName}
                    </Link>
                    <PartyBadge shortName={r.partyShortName} />
                  </span>
                </td>
                {COLS.map((c) => {
                  const active = sortKey === c;
                  const pct = active ? (metric(r, c) / max) * 100 : 0;
                  return (
                    <td key={c} className="relative px-3 py-2 text-right tabular-nums">
                      {active && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-y-1 right-0 rounded-sm"
                          style={{ width: `${pct}%`, backgroundColor: token.fill, opacity: 0.2 }}
                        />
                      )}
                      <span
                        className={`relative ${active ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                      >
                        {cell(r, c)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
