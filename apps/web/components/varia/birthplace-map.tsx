"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { BirthPin } from "@/lib/varia";

// Estonia bounding box. ponytail: a plain projection onto this box, not a real coastline SVG
// (no committed outline asset yet); dots still convey the W-E / N-S spread. Swap in an Estonia
// outline path behind the dots when one is added under public/varia/.
const LON0 = 21.7, LON1 = 28.3, LAT0 = 57.5, LAT1 = 59.75;
const W = 100, H = (LAT1 - LAT0) / (LON1 - LON0) * W * 1.9; // lat degrees are ~2x wider here

function project(lat: number, lon: number): [number, number] {
  const x = ((lon - LON0) / (LON1 - LON0)) * W;
  const y = (1 - (lat - LAT0) / (LAT1 - LAT0)) * H;
  return [x, y];
}

export function BirthplaceMap({ pins }: { pins: BirthPin[] }) {
  const t = useTranslations("varia");
  const [sel, setSel] = useState<BirthPin | null>(null);
  const max = Math.max(1, ...pins.map((p) => p.members.length));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
      <div className="rounded-md border border-border bg-muted/30 p-2">
        <svg viewBox={`-4 -4 ${W + 8} ${H + 8}`} className="w-full" role="img" aria-label={t("birthplaceH")}>
          {pins.map((p) => {
            const [x, y] = project(p.lat, p.lon);
            const r = 1.4 + (p.members.length / max) * 3.2;
            const active = sel?.town === p.town;
            return (
              <circle
                key={p.town}
                cx={x} cy={y} r={r}
                className="cursor-pointer"
                style={{ fill: "var(--foreground)", opacity: active ? 0.95 : 0.55 }}
                onClick={() => setSel(active ? null : p)}
              >
                <title>{`${p.town} (${p.members.length})`}</title>
              </circle>
            );
          })}
        </svg>
      </div>
      <div className="rounded-md border border-border p-3">
        {sel ? (
          <>
            <div className="mb-2 font-semibold">{sel.town}</div>
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
