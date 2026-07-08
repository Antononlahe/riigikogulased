"use client";

import { Fragment, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { MemberAvatar } from "@/components/member-avatar";
import { PartyBadge } from "@/components/party-badge";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import { PartyFilterBar } from "@/components/party-filter-bar";
import { partyToken } from "@/lib/party";
import type { ExpenseLeaderRow } from "@/lib/expenses-queries";

type SortKey = "limit" | "spent" | "unused" | "pct";
type SortDir = "asc" | "desc";

// CSV category key -> ascii message key (labels live in memberDetail.expenses.categories,
// shared with the member-page panel).
const CAT_KEY: Record<string, string> = {
  "sõidukulud": "travel",
  "side_ja_postikulud": "comms",
  "lähetuskulud": "trips",
  "majutuskulud": "lodging",
  "bürookulud": "office",
  "koolituskulud": "training",
  "tõlketeenuse_kulud": "translation",
  "uuringud_ja_ekspertiisid": "research",
  "esindus_ja_vastuvõtukulud": "representation",
  "tervishoiuteenused": "healthcare",
};

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
  const tc = useTranslations("memberDetail.expenses.categories");
  const [sortKey, setSortKey] = useState<SortKey>("spent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showDetail, setShowDetail] = useState(false);
  const [party, setParty] = useState<string | null>(null);
  const [showFormer, setShowFormer] = useState(false);

  const visible = useMemo(() => {
    const base = (showFormer ? rows : rows.filter((r) => r.active)).filter(
      (r) => party === null || r.partyShortName === party,
    );
    const s = [...base].sort((a, b) => metric(a, sortKey) - metric(b, sortKey));
    return sortDir === "desc" ? s.reverse() : s;
  }, [rows, party, showFormer, sortKey, sortDir]);
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
    <div>
      <PartyFilterBar
        party={party}
        onParty={setParty}
        showFormer={showFormer}
        onShowFormer={setShowFormer}
        count={visible.length}
      />
      <label className="mb-3 flex w-fit cursor-pointer items-center gap-2 text-[13px] font-medium text-muted-foreground hover:text-foreground">
        <input
          type="checkbox"
          checked={showDetail}
          onChange={(e) => setShowDetail(e.target.checked)}
          className="h-4 w-4 accent-foreground"
        />
        {t("showBreakdown")}
      </label>
      <div className="hidden sm:block">
      <ScrollableTable minWidthClass="min-w-[40rem]">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {t("member")}
            </th>
            {COLS.map((c) => (
              <th
                key={c}
                scope="col"
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
            const cats = Object.entries(r.breakdown).sort((a, b) => b[1] - a[1]);
            return (
              <Fragment key={r.memberId}>
              <tr
                className={`border-border hover:bg-secondary ${showDetail && cats.length ? "" : "border-b last:border-0"} ${r.active ? "" : "opacity-55"}`}
              >
                <th scope="row" className="px-4 py-2 text-left font-normal">
                  <span className="flex items-center gap-3 font-semibold">
                    <MemberAvatar
                      fullName={r.fullName}
                      photoThumbPath={r.photoThumbPath}
                      shortName={r.partyShortName}
                    />
                    <Link href={`/saadik/${r.slug}#kulud`} className="hover:underline">
                      {r.fullName}
                    </Link>
                    <PartyBadge shortName={r.partyShortName} />
                  </span>
                </th>
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
              {showDetail && cats.length > 0 && (
                <tr className="border-b border-border last:border-0 bg-secondary/40">
                  <td colSpan={1 + COLS.length} className="px-4 pb-3 pt-0">
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                      {cats.map(([key, amount]) => (
                        <span key={key} className="tabular-nums">
                          {tc(`${CAT_KEY[key] ?? "other"}` as "travel")}:{" "}
                          <span className="font-medium text-foreground">{eur(amount)}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            );
          })}
        </tbody>
      </ScrollableTable>
      </div>

      {/* Mobile: one card per member -- no sideways scroll. */}
      <ul className="space-y-2 sm:hidden">
        {visible.map((r) => {
          const cats = Object.entries(r.breakdown).sort((a, b) => b[1] - a[1]);
          return (
            <li
              key={r.memberId}
              className={`rounded-md border border-border p-3 ${r.active ? "" : "opacity-55"}`}
            >
              <span className="flex items-center gap-3 font-semibold">
                <MemberAvatar fullName={r.fullName} photoThumbPath={r.photoThumbPath} shortName={r.partyShortName} />
                <Link href={`/saadik/${r.slug}#kulud`} className="hover:underline">
                  {r.fullName}
                </Link>
                <PartyBadge shortName={r.partyShortName} />
              </span>
              <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {COLS.map((c) => (
                  <span key={c}>
                    {t(`col_${c}` as "col_spent")}:{" "}
                    <span className={`tabular-nums ${sortKey === c ? "font-semibold text-foreground" : "text-foreground"}`}>
                      {cell(r, c)}
                    </span>
                  </span>
                ))}
              </div>
              {showDetail && cats.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
                  {cats.map(([key, amount]) => (
                    <span key={key} className="tabular-nums">
                      {tc(`${CAT_KEY[key] ?? "other"}` as "travel")}:{" "}
                      <span className="font-medium text-foreground">{eur(amount)}</span>
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
