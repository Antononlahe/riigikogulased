"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { PartyBadge } from "@/components/party-badge";
import { partyToken, PARTY_ORDER } from "@/lib/party";
import type { TagCount, PartyProfession, UniRow, ChildRow } from "@/lib/varia";

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="font-serif text-xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Horizontal count bars, generic. */
function Bars({ rows, max }: { rows: { label: string; count: number; token?: string }[]; max: number }) {
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-sm" title={r.label}>{r.label}</span>
          <span className="relative h-5 flex-1 rounded-sm bg-muted">
            <span
              className="absolute inset-y-0 left-0 rounded-sm"
              style={{ width: `${(r.count / max) * 100}%`, backgroundColor: r.token ?? "var(--foreground)", opacity: 0.7 }}
            />
          </span>
          <span className="w-8 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

export function HobbyCloud({ hobbies }: { hobbies: TagCount[] }) {
  const t = useTranslations("varia");
  const max = Math.max(1, ...hobbies.map((h) => h.count));
  const min = Math.min(...hobbies.map((h) => h.count));
  const size = (c: number) => 14 + Math.round(((c - min) / Math.max(1, max - min)) * 20);
  return (
    <Section title={t("hobbiesH")} sub={t("hobbiesSub")}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        {hobbies.map((h) => (
          <span key={h.tag} className="font-semibold leading-tight" style={{ fontSize: `${size(h.count)}px` }}>
            {h.tag}
            <span className="ml-1 align-super text-[11px] font-normal text-muted-foreground">{h.count}</span>
          </span>
        ))}
      </div>
    </Section>
  );
}

export function Professions({ parties }: { parties: PartyProfession[] }) {
  const t = useTranslations("varia");
  const order = (p: PartyProfession) => {
    const i = PARTY_ORDER.indexOf(p.partyShortName as never);
    return i === -1 ? 99 : i;
  };
  const sorted = [...parties].sort((a, b) => order(a) - order(b));
  return (
    <Section title={t("professionsH")} sub={t("professionsSub")}>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sorted.map((p) => (
          <li key={p.partyShortName} className="rounded-md border border-border p-4">
            <div className="mb-2 flex items-center gap-2">
              <PartyBadge shortName={p.partyShortName} />
              <span className="text-xs text-muted-foreground">
                {p.members} {t("members")} · {t("diversity")} {(p.distinct / Math.max(1, p.members)).toFixed(2)}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {p.top.slice(0, 5).map((x) => (
                <span key={x.tag}>
                  {x.tag} <span className="tabular-nums text-muted-foreground">{x.count}</span>
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function Universities({ unis }: { unis: UniRow[] }) {
  const t = useTranslations("varia");
  const max = Math.max(1, ...unis.map((u) => u.count));
  return (
    <Section title={t("universitiesH")} sub={t("universitiesSub")}>
      <Bars rows={unis.map((u) => ({ label: u.university, count: u.count }))} max={max} />
    </Section>
  );
}

export function Children({ rows }: { rows: ChildRow[] }) {
  const t = useTranslations("varia");
  const total = rows.reduce((s, c) => s + c.children, 0);
  const avg = rows.length ? (total / rows.length).toFixed(1) : "0";
  const top = rows.slice(0, 8);
  return (
    <Section title={t("childrenH")} sub={t("childrenSub")}>
      <div className="mb-4 flex gap-3">
        <Stat label={t("childrenTotal")} value={total} />
        <Stat label={t("childrenAvg")} value={avg} />
      </div>
      <ul className="space-y-1.5">
        {top.map((c) => (
          <li key={c.slug} className="flex items-center gap-3">
            <span className="flex w-56 shrink-0 items-center gap-2">
              <Link href={`/members/${c.slug}`} className="truncate text-sm font-semibold hover:underline">
                {c.fullName}
              </Link>
              <PartyBadge shortName={c.partyShortName} />
            </span>
            <span className="flex gap-0.5" aria-label={`${c.children}`}>
              {Array.from({ length: c.children }).map((_, i) => (
                <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: partyToken(c.partyShortName).fill }} />
              ))}
            </span>
            <span className="text-sm tabular-nums text-muted-foreground">{c.children}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border px-4 py-2">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
