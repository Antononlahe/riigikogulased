"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { PartyBadge } from "@/components/party-badge";
import { partyToken, isKnownParty, PARTY_ORDER, type PartyShort } from "@/lib/party";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { groupPeople, type PeopleRow, type PeopleMember, type ChildRow } from "@/lib/varia";

// A faction must field at least this many members with data before its per-party stat is shown;
// below it we print "-" (ERK, with its single member, never qualifies -- and isn't a fraktsioon).
const MIN_PARTY = 5;

function Section({ id, title, sub, children }: { id?: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-20 first:mt-0">
      <h2 className="font-serif text-xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Members per fraktsioon, palette order, biggest first; unknown/ERK members dropped. */
function partyCounts(members: PeopleMember[]): { party: PartyShort; count: number }[] {
  const m = new Map<PartyShort, number>();
  for (const x of members)
    if (isKnownParty(x.party)) m.set(x.party, (m.get(x.party) ?? 0) + 1);
  return PARTY_ORDER.filter((p) => m.has(p))
    .map((p) => ({ party: p, count: m.get(p)! }))
    .sort((a, b) => b.count - a.count);
}

/** Party breakdown of a group: a badge + count per fraktsioon present. */
function PartyTally({ members }: { members: PeopleMember[] }) {
  const counts = partyCounts(members);
  if (counts.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {counts.map(({ party, count }) => (
        <span key={party} className="flex items-center gap-1 text-xs">
          <PartyBadge shortName={party} />
          <span className="tabular-nums text-muted-foreground">{count}</span>
        </span>
      ))}
    </div>
  );
}

/** Click `trigger` to pop up the party breakdown + members (name -> profile, with party badge).
 *  Radix handles open/close, escape, outside-click and positioning -- no extra dep. */
function PeoplePopup({ trigger, members }: { trigger: React.ReactNode; members: PeopleMember[] }) {
  const t = useTranslations("varia");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="cursor-pointer rounded-sm hover:underline focus-visible:outline-none">
          {trigger}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-60 overflow-y-auto">
        <div className="px-2 py-1.5">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {t("byParty")}
          </div>
          <PartyTally members={members} />
        </div>
        <div className="my-1 h-px bg-border" />
        {members.map((m) => (
          <DropdownMenuItem key={m.slug} asChild>
            <Link href={`/saadik/${m.slug}`} className="flex items-center gap-1.5">
              <span className="truncate">{m.fullName}</span>
              {m.party && <PartyBadge shortName={m.party} />}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Word cloud: bigger = more members. Each word pops up the party breakdown + who listed it. */
export function Hobbies({ rows }: { rows: PeopleRow[] }) {
  const t = useTranslations("varia");
  const groups = useMemo(() => groupPeople(rows), [rows]);
  const counts = groups.map((g) => g.members.length);
  const max = Math.max(1, ...counts);
  const min = Math.min(1, ...counts);
  const size = (c: number) => 14 + Math.round(((c - min) / Math.max(1, max - min)) * 20);
  return (
    <Section id="huvialad" title={t("hobbiesH")} sub={t("hobbiesSub")}>
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

/** Stacked-by-party magnitude bar: total length ~ group size vs the largest, segments by faction. */
function StackedBar({ members, max }: { members: PeopleMember[]; max: number }) {
  return (
    <span className="hidden h-2 w-24 overflow-hidden rounded-sm bg-muted sm:block" aria-hidden>
      <span className="flex h-full" style={{ width: `${(members.length / max) * 100}%` }}>
        {partyCounts(members).map(({ party, count }) => (
          <span
            key={party}
            className="block h-full"
            style={{ width: `${(count / members.length) * 100}%`, backgroundColor: partyToken(party).fill }}
          />
        ))}
      </span>
    </span>
  );
}

/** Click a university to reveal the party breakdown + who studied there. */
export function Universities({ rows }: { rows: PeopleRow[] }) {
  const t = useTranslations("varia");
  const groups = useMemo(() => groupPeople(rows), [rows]);
  const max = Math.max(1, ...groups.map((g) => g.members.length));
  const [open, setOpen] = useState<string | null>(null);
  const list: Row[] = groups.map((g) => ({ key: g.category, label: g.category, members: g.members }));
  return (
    <Section id="ulikoolid" title={t("universitiesH")} sub={t("universitiesSub")}>
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
                <StackedBar members={r.members} max={max} />
                <span className="w-8 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{r.members.length}</span>
              </button>
              {isOpen && (
                <div className="pb-3 pl-6">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {t("byParty")}
                    </span>
                    <PartyTally members={r.members} />
                  </div>
                  <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {r.members.map((m) => (
                      <li key={m.slug} className="flex items-center gap-1.5 text-sm">
                        <Link href={`/saadik/${m.slug}`} className="hover:underline">{m.fullName}</Link>
                        {m.party && <PartyBadge shortName={m.party} />}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

const CHILDREN_PREVIEW = 8;

export function Children({ rows }: { rows: ChildRow[] }) {
  const t = useTranslations("varia");
  const [showAll, setShowAll] = useState(false);
  const [info, setInfo] = useState(false);
  const [filter, setFilter] = useState<PartyShort | null>(null);
  // Headline stats are over members who state a number; members with none (children === null) are
  // shown in the list as 0 but excluded here so the average isn't diluted by unstated profiles.
  const withData = rows.filter((c) => c.children != null);
  const total = withData.reduce((s, c) => s + (c.children ?? 0), 0);
  const avg = withData.length ? (total / withData.length).toFixed(1) : "0";

  // Clicking a fraktsioon box filters the list to its members; clicking it again clears.
  const filtered = filter ? rows.filter((c) => c.partyShortName === filter) : rows;
  const top = showAll ? filtered : filtered.slice(0, CHILDREN_PREVIEW);

  // Per-fraktsioon "average per family": sum / members-with-data (>= MIN_PARTY, else "-"). `n`
  // (all members present, incl. unstated) gates whether the box filters. Only the six fraktsioons.
  const byParty = useMemo(() => {
    const acc = new Map<PartyShort, { sum: number; withData: number; n: number }>();
    for (const c of rows) {
      if (!isKnownParty(c.partyShortName)) continue;
      const e = acc.get(c.partyShortName) ?? { sum: 0, withData: 0, n: 0 };
      e.n += 1;
      if (c.children != null) {
        e.sum += c.children;
        e.withData += 1;
      }
      acc.set(c.partyShortName, e);
    }
    return PARTY_ORDER.map((p) => {
      const e = acc.get(p);
      return { party: p, n: e?.n ?? 0, value: e && e.withData >= MIN_PARTY ? (e.sum / e.withData).toFixed(1) : "-" };
    });
  }, [rows]);

  return (
    <Section id="lapsed" title={t("childrenH")} sub={t("childrenSub")}>
      <div className="mb-4 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => setInfo((v) => !v)}
          aria-expanded={info}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <span aria-hidden className="grid h-4 w-4 place-items-center rounded-full border border-current text-[10px]">i</span>
          {t("childrenInfoLabel")}
        </button>
        {info && <p className="mt-2 max-w-2xl leading-relaxed">{t("childrenInfo")}</p>}
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <Stat label={t("childrenTotal")} value={total} />
        <Stat label={t("childrenAvg")} value={avg} />
      </div>

      <div className="mb-5">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {t("childrenByParty")}
        </p>
        <div className="flex flex-wrap gap-2">
          {byParty.map(({ party, value, n }) => {
            const active = filter === party;
            return (
              <button
                key={party}
                type="button"
                disabled={n === 0}
                aria-pressed={active}
                onClick={() => setFilter((f) => (f === party ? null : party))}
                className={`flex items-center gap-2 rounded-md border px-3 py-1.5 transition-colors disabled:cursor-default disabled:opacity-50 ${
                  active ? "border-foreground bg-secondary" : "border-border hover:bg-secondary"
                }`}
                title={n === 0 ? undefined : t("childrenFilterHint")}
              >
                <PartyBadge shortName={party} />
                <span className="text-sm font-bold tabular-nums">{value}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <p className="text-sm font-semibold">{t("childrenTop")}</p>
        {filter && (
          <button
            type="button"
            onClick={() => setFilter(null)}
            className="text-xs font-medium text-ring hover:underline"
          >
            {t("childrenClearFilter")}
          </button>
        )}
      </div>
      <ul className="space-y-1.5">
        {top.map((c) => (
          <li key={c.slug} className="flex items-center gap-3">
            <span className="flex w-56 shrink-0 items-center gap-2">
              <Link href={`/saadik/${c.slug}`} className="truncate text-sm font-semibold hover:underline">
                {c.fullName}
              </Link>
              <PartyBadge shortName={c.partyShortName} />
            </span>
            <span className="flex gap-0.5" aria-label={`${c.children ?? 0}`}>
              {Array.from({ length: c.children ?? 0 }).map((_, i) => (
                <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: partyToken(c.partyShortName).fill }} />
              ))}
            </span>
            <span className="text-sm tabular-nums text-muted-foreground">{c.children ?? 0}</span>
          </li>
        ))}
      </ul>
      {filtered.length > CHILDREN_PREVIEW && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {showAll ? t("showLess") : t("showAllN", { n: filtered.length })}
        </button>
      )}
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
