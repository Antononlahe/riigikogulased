"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, MotionConfig } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { MemberDisciplineRow } from "@/lib/queries";
import { sortRows, filterByParty, mandateKey, type SortKey, type SortDir } from "@/lib/members";
import { PARTY_ORDER } from "@/lib/party";
import { MemberAvatar } from "@/components/member-avatar";
import { PartyBadge } from "@/components/party-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/routing";

type Col = { key: SortKey; numeric: boolean };
const COLS: Col[] = [
  { key: "name", numeric: false },
  { key: "discipline", numeric: true },
  { key: "counted", numeric: true },
  { key: "defections", numeric: true },
  { key: "attendance", numeric: true },
];

export function MembersTable({ rows }: { rows: MemberDisciplineRow[] }) {
  const t = useTranslations("table");
  const f = useTranslations("filter");
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

  return (
    <MotionConfig reducedMotion="user">
      <div className="mb-3 flex items-center justify-between">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {party ?? f("all")} <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setParty(null)}>{f("all")}</DropdownMenuItem>
            {PARTY_ORDER.map((p) => (
              <DropdownMenuItem key={p} onClick={() => setParty(p)}>
                {p}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <label className="ml-3 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-foreground"
            checked={showFormer}
            onChange={(e) => setShowFormer(e.target.checked)}
          />
          {f("showFormer")}
        </label>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {t("showing", { count: visible.length })}
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              {COLS.map((c) => (
                <th
                  key={c.key}
                  aria-sort={
                    sortKey === c.key ? (sortDir === "asc" ? "ascending" : "descending") : undefined
                  }
                  className={`px-4 py-3 ${c.numeric ? "text-right" : ""} ${c.key === "defections" || c.key === "attendance" ? "border-r border-border" : ""}`}
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
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-3 font-semibold">
                    <MemberAvatar
                      fullName={r.fullName}
                      photoThumbPath={r.photoThumbPath}
                      shortName={r.partyShortName}
                    />
                    <Link
                      href={`/members/${r.slug}`}
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
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="font-semibold tabular-nums">
                    {r.disciplineScore === null
                      ? "—"
                      : `${(Math.round(r.disciplineScore * 1000) / 10).toFixed(1)}%`}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {r.countedVotes}
                </td>
                <td className="border-r border-border px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {r.defections}
                </td>
                <td className="border-r border-border px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {r.attendance === null ? "—" : `${(r.attendance * 100).toFixed(1)}%`}
                </td>
                <td className="px-4 py-2.5">
                  {(() => {
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
                  })()}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </MotionConfig>
  );
}
