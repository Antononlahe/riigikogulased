"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, MotionConfig } from "framer-motion";
import { ChevronDown } from "lucide-react";
import {
  sortCommittees,
  type CommitteeRow,
  type CommitteeSortKey,
  type SortDir,
} from "@/lib/committees";
import { CommitteeCard } from "@/components/statistika/committee-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const KEYS: CommitteeSortKey[] = ["cohesion", "members", "defections"];

export function CommitteeGrid({ rows }: { rows: CommitteeRow[] }) {
  const t = useTranslations("statistika");
  const [sortKey, setSortKey] = useState<CommitteeSortKey>("cohesion");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const visible = useMemo(() => sortCommittees(rows, sortKey, sortDir), [rows, sortKey, sortDir]);

  function choose(key: CommitteeSortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{t("sortBy")}:</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {t(sortKey)} {sortDir === "asc" ? "↑" : "↓"} <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {KEYS.map((k) => (
              <DropdownMenuItem key={k} onClick={() => choose(k)}>
                {t(k)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((r) => (
          <motion.div key={r.committeeId} layout transition={{ duration: 0.2 }}>
            <CommitteeCard row={r} />
          </motion.div>
        ))}
      </div>
    </MotionConfig>
  );
}
