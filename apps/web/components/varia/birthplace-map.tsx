"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { PartyBadge } from "@/components/party-badge";
import { ESTONIA_PATH, projectEstonia } from "@/lib/estonia-geo";
import { PARTY_ORDER, partyToken } from "@/lib/party";
import type { BirthPin } from "@/lib/varia";

/** party -> members, in PARTY_ORDER then a trailing "-" bucket for the unaffiliated. */
function partySlices(members: BirthPin["members"]) {
  const groups = new Map<string | null, BirthPin["members"]>();
  for (const order of [...PARTY_ORDER, null]) groups.set(order, []);
  for (const m of members) groups.get(PARTY_ORDER.includes(m.party as never) ? m.party : null)!.push(m);
  return [...groups.entries()].filter(([, ms]) => ms.length > 0);
}

/** SVG arc path for a pie slice of radius r centred at (cx, cy), spanning [a0, a1) radians. */
function wedgePath(cx: number, cy: number, r: number, a0: number, a1: number) {
  if (a1 - a0 >= Math.PI * 2 - 1e-6) {
    // Full circle: two half-arcs (a single arc command can't span 360deg).
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
  }
  const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

export function BirthplaceMap({ pins }: { pins: BirthPin[] }) {
  const t = useTranslations("varia");
  const [sel, setSel] = useState<BirthPin | null>(null);
  const max = Math.max(1, ...pins.map((p) => p.members.length));
  // Draw larger bubbles last so they don't hide small ones; keeps clicks sensible.
  const ordered = [...pins].sort((a, b) => a.members.length - b.members.length);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[3fr_2fr]">
      <div className="rounded-md border border-border bg-card p-2">
        <svg viewBox={`-4 -4 108 73`} className="w-full" role="img" aria-label={t("birthplaceH")}>
          <path d={ESTONIA_PATH} fill="var(--muted)" stroke="var(--border)" strokeWidth={0.4} />
          {ordered.map((p) => {
            const [x, y] = projectEstonia(p.lat, p.lon);
            const n = p.members.length;
            const r = 1.3 + Math.sqrt(n / max) * 4.2;
            const active = sel?.town === p.town;
            const slices = partySlices(p.members);
            let angle = -Math.PI / 2;
            return (
              <g
                key={p.town}
                className="cursor-pointer"
                onMouseEnter={() => setSel(p)}
                onClick={() => setSel(active ? null : p)}
              >
                {slices.map(([party, ms]) => {
                  const span = (ms.length / n) * Math.PI * 2;
                  const a0 = angle;
                  angle += span;
                  return (
                    <motion.path
                      key={party ?? "-"}
                      d={wedgePath(x, y, r, a0, angle)}
                      initial={false}
                      animate={{ scale: active ? 1.15 : 1, opacity: active ? 1 : 0.8 }}
                      style={{ transformOrigin: `${x}px ${y}px`, stroke: "var(--card)", strokeWidth: 0.25 }}
                      fill={partyToken(party).fill}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    />
                  );
                })}
                {n > 1 && (
                  <text
                    x={x} y={y} dy="0.32em" textAnchor="middle"
                    style={{ fontSize: `${Math.min(r * 1.1, 3.4)}px`, fill: "#fff", fontWeight: 700, pointerEvents: "none" }}
                  >
                    {n}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="rounded-md border border-border p-3">
        <AnimatePresence mode="wait">
          {sel ? (
            <motion.div
              key={sel.town}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="mb-3 flex items-baseline justify-between">
                <span className="font-semibold">{sel.town}</span>
                <span className="text-sm text-muted-foreground">{sel.members.length} {t("members")}</span>
              </div>
              {/* Burst: the pie splits into its party slices, each listing its members. */}
              <div className="space-y-3">
                {partySlices(sel.members).map(([party, ms], gi) => (
                  <motion.div
                    key={party ?? "-"}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22, delay: gi * 0.05 }}
                  >
                    <PartyBadge shortName={party} />
                    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      {ms.map((m) => (
                        <li key={m.slug}>
                          <Link href={`/saadik/${m.slug}`} className="text-sm hover:underline">{m.fullName}</Link>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-muted-foreground">
              {t("birthplaceSub")}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
