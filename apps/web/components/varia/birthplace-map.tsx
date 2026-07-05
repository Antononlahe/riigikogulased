"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { ESTONIA_PATH, projectEstonia } from "@/lib/estonia-geo";
import type { BirthPin } from "@/lib/varia";

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
            return (
              <g
                key={p.town}
                className="cursor-pointer"
                onMouseEnter={() => setSel(p)}
                onClick={() => setSel(active ? null : p)}
              >
                <circle
                  cx={x} cy={y} r={r}
                  style={{
                    fill: "var(--primary, #2563eb)",
                    opacity: active ? 1 : 0.75,
                    stroke: "var(--card)", strokeWidth: 0.3,
                  }}
                />
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
        {sel ? (
          <>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="font-semibold">{sel.town}</span>
              <span className="text-sm text-muted-foreground">{sel.members.length} {t("members")}</span>
            </div>
            <ul className="space-y-1 text-sm">
              {sel.members.map((m) => (
                <li key={m.slug}>
                  <Link href={`/members/${m.slug}`} className="hover:underline">{m.fullName}</Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("birthplaceSub")}</p>
        )}
      </div>
    </div>
  );
}
