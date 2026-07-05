"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { PartyBadge } from "@/components/party-badge";
import { partyToken, PARTY_ORDER } from "@/lib/party";
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

/** One member line: name + party badge (+ optional detail note, e.g. the profession). */
function MemberLine({ m, showBadge }: { m: PeopleMember; showBadge: boolean }) {
  return (
    <li className="flex items-center gap-1.5 text-sm">
      <Link href={`/members/${m.slug}`} className="hover:underline">{m.fullName}</Link>
      {showBadge && m.party && <PartyBadge shortName={m.party} />}
      {m.detail && <span className="text-muted-foreground">· {m.detail}</span>}
    </li>
  );
}

type Row = { key: string; label: React.ReactNode; count: number; members: PeopleMember[]; showBadge: boolean };

/** Click a category to reveal its members. Data is already loaded, so this is pure UI. */
function Accordion({ rows, max }: { rows: Row[]; max: number }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => {
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
                <span className="block h-full rounded-sm bg-foreground/60" style={{ width: `${(r.count / max) * 100}%` }} />
              </span>
              <span className="w-8 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{r.count}</span>
            </button>
            {isOpen && (
              <ul className="flex flex-wrap gap-x-4 gap-y-1.5 pb-3 pl-6">
                {r.members.map((m) => (
                  <MemberLine key={m.slug} m={m} showBadge={r.showBadge} />
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Hobbies({ rows }: { rows: PeopleRow[] }) {
  const t = useTranslations("varia");
  const groups = useMemo(() => groupPeople(rows), [rows]);
  const max = Math.max(1, ...groups.map((g) => g.members.length));
  return (
    <Section title={t("hobbiesH")} sub={t("hobbiesSub")}>
      <Accordion
        max={max}
        rows={groups.map((g) => ({ key: g.category, label: g.category, count: g.members.length, members: g.members, showBadge: true }))}
      />
    </Section>
  );
}

export function Universities({ rows }: { rows: PeopleRow[] }) {
  const t = useTranslations("varia");
  const groups = useMemo(() => groupPeople(rows), [rows]);
  const max = Math.max(1, ...groups.map((g) => g.members.length));
  return (
    <Section title={t("universitiesH")} sub={t("universitiesSub")}>
      <Accordion
        max={max}
        rows={groups.map((g) => ({ key: g.category, label: g.category, count: g.members.length, members: g.members, showBadge: true }))}
      />
    </Section>
  );
}

export function Professions({ rows }: { rows: PeopleRow[] }) {
  const t = useTranslations("varia");
  // Ordered by the shared party order; the '-' (no-faction) bucket sorts last.
  const groups = useMemo(() => {
    const order = (c: string) => {
      const i = PARTY_ORDER.indexOf(c as never);
      return i === -1 ? 99 : i;
    };
    return groupPeople(rows).sort((a, b) => order(a.category) - order(b.category));
  }, [rows]);
  const max = Math.max(1, ...groups.map((g) => g.members.length));
  return (
    <Section title={t("professionsH")} sub={t("professionsSub")}>
      <Accordion
        max={max}
        rows={groups.map((g) => ({
          key: g.category,
          label:
            g.category === "-" ? (
              <span className="text-muted-foreground">{t("noFaction")}</span>
            ) : (
              <PartyBadge shortName={g.category} />
            ),
          count: g.members.length,
          members: g.members,
          showBadge: false, // grouped by party already; show the profession detail instead
        }))}
      />
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
