"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, MotionConfig } from "framer-motion";
import type { MemberDisciplineRow } from "@/lib/queries";
import { sortRows, filterByParty, mandateKey, type SortKey, type SortDir } from "@/lib/members";
import { MemberAvatar } from "@/components/member-avatar";
import { PartyBadge } from "@/components/party-badge";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import { PartyFilterBar } from "@/components/party-filter-bar";
import { SortMenu } from "@/components/sort-menu";
import { Link } from "@/i18n/routing";

// `hide` trims lower-value columns on small screens (the table only shows at sm+; cards take over
// below). Counted votes is the least useful at a glance, so it drops until md.
type Col = { key: SortKey; numeric: boolean; hide?: string };
const COLS: Col[] = [
  { key: "name", numeric: false },
  { key: "discipline", numeric: true },
  { key: "counted", numeric: true, hide: "hidden md:table-cell" },
  { key: "defections", numeric: true },
  { key: "attendance", numeric: true },
];

const discPct = (r: MemberDisciplineRow) =>
  r.disciplineScore === null ? "—" : `${(Math.round(r.disciplineScore * 1000) / 10).toFixed(1)}%`;
const attPct = (r: MemberDisciplineRow) =>
  r.attendance === null ? "—" : `${(r.attendance * 100).toFixed(1)}%`;

export function MembersTable({ rows }: { rows: MemberDisciplineRow[] }) {
  const t = useTranslations("table");
  const te = useTranslations("memberDetail.election");
  const [sortKey, setSortKey] = useState<SortKey>("discipline");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [party, setParty] = useState<string | null>(null);
  // Off by default: show only members currently in parliament (~101). On: include former MPs.
  const [showFormer, setShowFormer] = useState(false);

  const visible = useMemo(() => {
    const base = showFormer ? rows : rows.filter((r) => r.active);
    return sortRows(filterByParty(base, party), sortKey, sortDir);
  }, [rows, party, showFormer, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function mandate(r: MemberDisciplineRow) {
    const key = mandateKey(r);
    if (!key) return <span className="text-muted-foreground">—</span>;
    return (
      <span className="flex items-center gap-2">
        {r.electionVotes != null && (
          <b className="tabular-nums">{r.electionVotes.toLocaleString("et")}</b>
        )}
        <span className="inline-block rounded-sm bg-secondary px-1.5 py-0.5 text-[11px] font-medium">
          {te(`mandate.${key}` as "mandate.personal")}
        </span>
      </span>
    );
  }

  function nameCell(r: MemberDisciplineRow) {
    return (
      <span className="flex items-center gap-3 font-semibold">
        <MemberAvatar fullName={r.fullName} photoThumbPath={r.photoThumbPath} shortName={r.partyShortName} />
        <Link
          href={`/saadik/${r.slug}`}
          className="hover:underline"
          style={{ viewTransitionName: `member-${r.slug}` }}
        >
          {r.fullName}
        </Link>
        <PartyBadge shortName={r.partyShortName} name={r.partyName} />
        {!r.active && (
          <span className="rounded-sm bg-secondary px-1 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("former")}
          </span>
        )}
      </span>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <PartyFilterBar
        party={party}
        onParty={setParty}
        showFormer={showFormer}
        onShowFormer={setShowFormer}
        count={visible.length}
      />

      {/* Desktop / tablet: the table (with working horizontal scroll). */}
      <div className="hidden sm:block">
        <ScrollableTable minWidthClass="min-w-[44rem]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              {COLS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={
                    sortKey === c.key ? (sortDir === "asc" ? "ascending" : "descending") : undefined
                  }
                  className={`px-4 py-3 ${c.numeric ? "text-right" : ""} ${c.key === "defections" || c.key === "attendance" ? "border-r border-border" : ""} ${c.hide ?? ""}`}
                >
                  <button
                    className="inline-flex items-center gap-1 font-semibold uppercase hover:text-foreground"
                    onClick={() => toggleSort(c.key)}
                  >
                    {t(`sort.${c.key}` as `sort.${SortKey}`)}
                    {sortKey === c.key ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
              ))}
              <th
                scope="col"
                aria-sort={sortKey === "votes" ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                className="px-4 py-3"
              >
                <button
                  className="inline-flex items-center gap-1 font-semibold uppercase hover:text-foreground"
                  onClick={() => toggleSort("votes")}
                >
                  {t("mandate")}
                  {sortKey === "votes" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <motion.tr
                key={r.memberId}
                layout
                transition={{ duration: 0.2 }}
                className={`border-b border-border last:border-0 hover:bg-secondary ${r.active ? "" : "opacity-55"}`}
              >
                <th scope="row" className="px-4 py-2.5 text-left font-normal">{nameCell(r)}</th>
                <td className="px-4 py-2.5 text-right">
                  <span className="font-semibold tabular-nums">{discPct(r)}</span>
                </td>
                <td className="hidden px-4 py-2.5 text-right tabular-nums text-muted-foreground md:table-cell">
                  {r.countedVotes}
                </td>
                <td className="border-r border-border px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {r.defections}
                </td>
                <td className="border-r border-border px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {attPct(r)}
                </td>
                <td className="px-4 py-2.5">{mandate(r)}</td>
              </motion.tr>
            ))}
          </tbody>
        </ScrollableTable>
      </div>

      {/* Mobile: one card per member -- no sideways scroll. */}
      <SortMenu
        className="mb-3 sm:hidden"
        label={t("sortBy")}
        sortKey={sortKey}
        sortDir={sortDir}
        onToggle={toggleSort}
        options={[
          ...COLS.map((c) => ({ key: c.key, label: t(`sort.${c.key}` as `sort.${SortKey}`) })),
          { key: "votes" as SortKey, label: t("mandate") },
        ]}
      />
      <ul className="space-y-2 sm:hidden">
        {visible.map((r) => (
          <li
            key={r.memberId}
            className={`rounded-md border border-border p-3 ${r.active ? "" : "opacity-55"}`}
          >
            {nameCell(r)}
            <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                {t("sort.discipline")}:{" "}
                <span className="font-semibold tabular-nums text-foreground">{discPct(r)}</span>
              </span>
              <span>
                {t("sort.attendance")}:{" "}
                <span className="tabular-nums text-foreground">{attPct(r)}</span>
              </span>
              <span>
                {t("sort.defections")}:{" "}
                <span className="tabular-nums text-foreground">{r.defections}</span>
              </span>
              <span>
                {t("sort.counted")}:{" "}
                <span className="tabular-nums text-foreground">{r.countedVotes}</span>
              </span>
            </div>
            <div className="mt-2 text-xs">{mandate(r)}</div>
          </li>
        ))}
      </ul>
    </MotionConfig>
  );
}
