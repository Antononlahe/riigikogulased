"use client";

import { motion } from "framer-motion";
import { partyToken } from "@/lib/party";
import {
  factionMetric,
  type FactionComparisonRow,
  type FactionSortKey,
} from "@/lib/factions";

/** Display string for a metric value: rates as %, member count as an integer. */
function format(value: number | null, key: FactionSortKey): string {
  if (value === null) return "—";
  if (key === "members") return String(value);
  return `${(Math.round(value * 1000) / 10).toFixed(1)}%`;
}

/**
 * Comparative horizontal bars for the current sort metric, one per faction. Shares the
 * sorted `rows` + `sortKey` with the card grid so both reorder together; bars are scaled
 * relative to the largest value (exact figures are labelled, so the relative scale doesn't
 * mislead). Reordering animates via Framer `layout` (honors prefers-reduced-motion through
 * the parent MotionConfig).
 */
export function FactionBars({
  rows,
  sortKey,
}: {
  rows: FactionComparisonRow[];
  sortKey: FactionSortKey;
}) {
  const max = Math.max(0, ...rows.map((r) => factionMetric(r, sortKey) ?? 0));
  return (
    <div className="mb-6 flex flex-col gap-1.5">
      {rows.map((r) => {
        const value = factionMetric(r, sortKey);
        const token = partyToken(r.partyShortName);
        const width = max > 0 && value !== null ? (value / max) * 100 : 0;
        return (
          <motion.div key={r.partyId} layout transition={{ duration: 0.2 }} className="flex items-center gap-2">
            <span
              className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums"
              style={{ color: token.ink }}
            >
              {r.partyShortName}
            </span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-muted" aria-hidden>
              <motion.div
                className="h-full rounded"
                style={{ background: token.fill }}
                initial={false}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span className="w-14 shrink-0 text-right text-xs font-semibold tabular-nums">
              {format(value, sortKey)}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
