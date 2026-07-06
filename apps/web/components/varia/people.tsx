"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { PartyBadge } from "@/components/party-badge";
import { partyToken } from "@/lib/party";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { groupPeople, type PeopleRow, type PeopleMember, type ChildRow } from "@/lib/varia";

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="font-serif text-xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Click `trigger` to pop up the members it represents (name -> profile, with party badge).
 *  Radix handles open/close, escape, outside-click and positioning -- no extra dep. */
function PeoplePopup({ trigger, members }: { trigger: React.ReactNode; members: PeopleMember[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="cursor-pointer rounded-sm hover:underline focus-visible:outline-none">
          {trigger}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        {members.map((m) => (
          <DropdownMenuItem key={m.slug} asChild>
            <Link href={`/members/${m.slug}`} className="flex items-center gap-1.5">
              <span className="truncate">{m.fullName}</span>
              {m.party && <PartyBadge shortName={m.party} />}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Word cloud: bigger = more members. Each word pops up who listed that interest. */
export function Hobbies({ rows }: { rows: PeopleRow[] }) {
  const t = useTranslations("varia");
  const groups = useMemo(() => groupPeople(rows), [rows]);
  const counts = groups.map((g) => g.members.length);
  const max = Math.max(1, ...counts);
  const min = Math.min(1, ...counts);
  const size = (c: number) => 14 + Math.round(((c - min) / Math.max(1, max - min)) * 20);
  return (
    <Section title={t("hobbiesH")} sub={t("hobbiesSub")}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        {groups.map((g) => (
          <PeoplePopup
            key={g.category}
            members={g.members}
            trigger={
              <span className="font-semibold leading-tight" style={{ fontSize: `${size(g.members.length)}px` }}>
                {g.category}
                <span className="ml-1 align-super text-[11px] font-normal text-muted-foreground">{g.members.length}</span>
              </span>
            }
          />
        ))}
      </div>
    </Section>
  );
}

type Row = { key: string; label: string; members: PeopleMember[] };

/** Click a university to reveal who studied there. */
export function Universities({ rows }: { rows: PeopleRow[] }) {
  const t = useTranslations("varia");
  const groups = useMemo(() => groupPeople(rows), [rows]);
  const max = Math.max(1, ...groups.map((g) => g.members.length));
  const [open, setOpen] = useState<string | null>(null);
  const list: Row[] = groups.map((g) => ({ key: g.category, label: g.category, members: g.members }));
  return (
    <Section title={t("universitiesH")} sub={t("universitiesSub")}>
      <ul className="divide-y divide-border">
        {list.map((r) => {
          const isOpen = open === r.key;
          return (
            <li key={r.key}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : r.key)}
                className="flex w-full items-center gap-3 py-2 text-left"
                aria-expanded={isOpen}
              >
                <span aria-hidden className={`text-xs text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.label}</span>
                <span className="hidden h-2 w-24 rounded-sm bg-muted sm:block" aria-hidden>
                  <span className="block h-full rounded-sm bg-foreground/60" style={{ width: `${(r.members.length / max) * 100}%` }} />
                </span>
                <span className="w-8 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{r.members.length}</span>
              </button>
              {isOpen && (
                <ul className="flex flex-wrap gap-x-4 gap-y-1.5 pb-3 pl-6">
                  {r.members.map((m) => (
                    <li key={m.slug} className="flex items-center gap-1.5 text-sm">
                      <Link href={`/members/${m.slug}`} className="hover:underline">{m.fullName}</Link>
                      {m.party && <PartyBadge shortName={m.party} />}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
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
      <p className="mb-2 text-sm font-semibold">{t("childrenTop")}</p>
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
