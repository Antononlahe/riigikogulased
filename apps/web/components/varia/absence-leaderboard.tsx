"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { MemberAvatar } from "@/components/member-avatar";
import { PartyBadge } from "@/components/party-badge";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import { PartyFilterBar } from "@/components/party-filter-bar";
import { SortMenu } from "@/components/sort-menu";
import { partyToken } from "@/lib/party";
import { sortAbsence, type AbsenceRow, type AbsenceSortKey } from "@/lib/varia";

export function AbsenceLeaderboard({ rows }: { rows: AbsenceRow[] }) {
  const t = useTranslations("varia");
  const [sortKey, setSortKey] = useState<AbsenceSortKey>("absentPct");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [party, setParty] = useState<string | null>(null);
  const [showFormer, setShowFormer] = useState(false);
  const visible = useMemo(() => {
    const base = (showFormer ? rows : rows.filter((r) => r.active)).filter(
      (r) => party === null || r.partyShortName === party,
    );
    return sortAbsence(base, dir, sortKey);
  }, [rows, party, showFormer, dir, sortKey]);
  const max = useMemo(() => Math.max(1, ...rows.map((r) => r.absentPct)), [rows]);

  function toggleSort(key: AbsenceSortKey) {
    if (key === sortKey) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDir("desc");
    }
  }

  function SortHeader({ sortKeyName, label }: { sortKeyName: AbsenceSortKey; label: string }) {
    const active = sortKey === sortKeyName;
    return (
      <th scope="col" className="px-3 py-2 text-right" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
        <button
          onClick={() => toggleSort(sortKeyName)}
          className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground"
        >
          {label} {active ? (dir === "asc" ? "↑" : "↓") : ""}
        </button>
      </th>
    );
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
      {/* Desktop table */}
      <div className="hidden sm:block">
        <ScrollableTable minWidthClass="min-w-[34rem]">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {t("member")}
              </th>
              <SortHeader sortKeyName="total" label={t("totalVotes")} />
              <SortHeader sortKeyName="absent" label={t("absentVotes")} />
              <SortHeader sortKeyName="absentPct" label={t("absentPct")} />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const token = partyToken(r.partyShortName);
              const pct = (r.absentPct / max) * 100;
              return (
                <tr key={r.memberId} className={`border-b border-border last:border-0 hover:bg-secondary ${r.active ? "" : "opacity-55"}`}>
                  <th scope="row" className="px-4 py-2 text-left font-normal">
                    <span className="flex items-center gap-3 font-semibold">
                      <MemberAvatar fullName={r.fullName} photoThumbPath={r.photoThumbPath} shortName={r.partyShortName} />
                      <Link href={`/saadik/${r.slug}#haaletused`} className="hover:underline">
                        {r.fullName}
                      </Link>
                      <PartyBadge shortName={r.partyShortName} />
                    </span>
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.total}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.absent}</td>
                  <td className="relative px-3 py-2 text-right tabular-nums">
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-1 right-0 rounded-sm"
                      style={{ width: `${pct}%`, backgroundColor: token.fill, opacity: 0.2 }}
                    />
                    <span className="relative font-semibold text-foreground">{r.absentPct}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </ScrollableTable>
      </div>

      {/* Mobile: one card per member */}
      <SortMenu
        className="mb-3 sm:hidden"
        label={t("sortBy")}
        sortKey={sortKey}
        sortDir={dir}
        onToggle={toggleSort}
        options={[
          { key: "total", label: t("totalVotes") },
          { key: "absent", label: t("absentVotes") },
          { key: "absentPct", label: t("absentPct") },
        ]}
      />
      <ul className="space-y-2 sm:hidden">
        {visible.map((r) => (
          <li key={r.memberId} className={`rounded-md border border-border p-3 ${r.active ? "" : "opacity-55"}`}>
            <span className="flex items-center gap-3 font-semibold">
              <MemberAvatar fullName={r.fullName} photoThumbPath={r.photoThumbPath} shortName={r.partyShortName} />
              <Link href={`/saadik/${r.slug}#haaletused`} className="hover:underline">
                {r.fullName}
              </Link>
              <PartyBadge shortName={r.partyShortName} />
              <span className="ml-auto tabular-nums font-bold text-foreground">{r.absentPct}%</span>
            </span>
            <div className="mt-2 text-xs text-muted-foreground">
              {t("absentVotes")}: <span className="tabular-nums text-foreground">{r.absent}</span> ·{" "}
              {t("totalVotes")}: <span className="tabular-nums text-foreground">{r.total}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
