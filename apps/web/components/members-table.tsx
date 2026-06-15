"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, MotionConfig } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { MemberDisciplineRow } from "@/lib/queries";
import { sortRows, filterByParty, type SortKey, type SortDir } from "@/lib/members";
import { PARTY_ORDER } from "@/lib/party";
import { MemberAvatar } from "@/components/member-avatar";
import { PartyBadge } from "@/components/party-badge";
import { DisciplineBar } from "@/components/discipline-bar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Col = { key: SortKey; numeric: boolean };
const COLS: Col[] = [
  { key: "name", numeric: false },
  { key: "discipline", numeric: true },
  { key: "counted", numeric: true },
  { key: "defections", numeric: true },
];

export function MembersTable({ rows }: { rows: MemberDisciplineRow[] }) {
  const t = useTranslations("table");
  const f = useTranslations("filter");
  const [sortKey, setSortKey] = useState<SortKey>("discipline");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [party, setParty] = useState<string | null>(null);

  const visible = useMemo(
    () => sortRows(filterByParty(rows, party), sortKey, sortDir),
    [rows, party, sortKey, sortDir],
  );

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "asc");
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
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              {COLS.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-3 ${c.numeric ? "text-right" : ""}`}
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
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <motion.tr
                key={r.memberId}
                layout
                transition={{ duration: 0.2 }}
                className="border-b border-border last:border-0 hover:bg-secondary"
              >
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-3 font-semibold">
                    <MemberAvatar
                      fullName={r.fullName}
                      photoThumbPath={r.photoThumbPath}
                      shortName={r.partyShortName}
                    />
                    {r.fullName}
                    <PartyBadge shortName={r.partyShortName} name={r.partyName} />
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <DisciplineBar score={r.disciplineScore} shortName={r.partyShortName} />
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {r.countedVotes}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {r.defections}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </MotionConfig>
  );
}
