"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { PartyBadge } from "@/components/party-badge";
import { PARTY_ORDER } from "@/lib/party";
import { friendshipCountry, type CaucusMember } from "@/lib/varia";

type Member = { fullName: string; slug: string; party: string | null };
const rank = (p: string | null) => {
  const i = p ? PARTY_ORDER.indexOf(p as never) : -1;
  return i === -1 ? 99 : i;
};
const byParty = (a: Member, b: Member) => rank(a.party) - rank(b.party) || a.fullName.localeCompare(b.fullName, "et");

function MemberList({ members }: { members: Member[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 pt-2">
      {members.map((m) => (
        <li key={m.slug} className="flex items-center gap-1.5 text-sm">
          <Link href={`/members/${m.slug}`} className="hover:underline">{m.fullName}</Link>
          {m.party && <PartyBadge shortName={m.party} />}
        </li>
      ))}
    </ul>
  );
}

type Row = { key: string; label: string; meta: string; body: React.ReactNode; bar?: number };

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
              {r.bar !== undefined && (
                <span className="hidden h-2 w-24 rounded-sm bg-muted sm:block">
                  <span className="block h-full rounded-sm bg-foreground/60" style={{ width: `${(r.bar / max) * 100}%` }} />
                </span>
              )}
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{r.meta}</span>
            </button>
            {isOpen && <div className="pb-3 pl-6">{r.body}</div>}
          </li>
        );
      })}
    </ul>
  );
}

// Collapsed by default (each section is long). Native <details> -- no JS, accessible.
function Section({ title, sub, count, children }: { title: string; sub: string; count: number; children: React.ReactNode }) {
  return (
    <details className="group mt-4 rounded-md border border-border first:mt-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
        <span aria-hidden className="text-xs text-muted-foreground transition-transform group-open:rotate-90">▶</span>
        <span className="min-w-0 flex-1">
          <span className="font-serif text-xl font-bold tracking-tight">{title}</span>
          <span className="block text-sm text-muted-foreground">{sub}</span>
        </span>
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{count}</span>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

export function Network({ friendship, causes }: { friendship: CaucusMember[]; causes: CaucusMember[] }) {
  const t = useTranslations("varia");
  const [allMembers, setAllMembers] = useState(false);

  const { countryRows, memberRows, causeRows } = useMemo(() => {
    const countries = new Map<string, Map<string, Member>>();
    const causeMap = new Map<string, Member[]>();
    const members = new Map<string, { m: Member; friendship: Set<string>; causes: string[] }>();
    const touch = (r: CaucusMember) => {
      if (!members.has(r.slug)) {
        members.set(r.slug, { m: { fullName: r.fullName, slug: r.slug, party: r.party }, friendship: new Set(), causes: [] });
      }
      return members.get(r.slug)!;
    };
    for (const r of friendship) {
      const c = friendshipCountry(r.name);
      if (!countries.has(c)) countries.set(c, new Map());
      countries.get(c)!.set(r.slug, { fullName: r.fullName, slug: r.slug, party: r.party });
      touch(r).friendship.add(c);
    }
    for (const r of causes) {
      if (!causeMap.has(r.name)) causeMap.set(r.name, []);
      causeMap.get(r.name)!.push({ fullName: r.fullName, slug: r.slug, party: r.party });
      touch(r).causes.push(r.name);
    }
    const countryRows = [...countries.entries()]
      .map(([label, m]) => ({ label, members: [...m.values()].sort(byParty) }))
      .sort((a, b) => b.members.length - a.members.length || a.label.localeCompare(b.label, "et"));
    const causeRows = [...causeMap.entries()]
      .map(([label, ms]) => ({ label, members: ms.sort(byParty), parties: new Set(ms.map((m) => m.party).filter(Boolean)).size }))
      .sort((a, b) => b.members.length - a.members.length || a.label.localeCompare(b.label, "et"));
    const memberRows = [...members.values()]
      .map((e) => ({ ...e, total: e.friendship.size + e.causes.length }))
      .sort((a, b) => b.total - a.total || a.m.fullName.localeCompare(b.m.fullName, "et"));
    return { countryRows, memberRows, causeRows };
  }, [friendship, causes]);

  const shownMembers = allMembers ? memberRows : memberRows.slice(0, 20);

  return (
    <>
      <Section title={t("friendshipH")} sub={t("friendshipSub")} count={countryRows.length}>
        <Accordion
          max={Math.max(1, ...countryRows.map((r) => r.members.length))}
          rows={countryRows.map((r) => ({
            key: r.label, label: r.label, bar: r.members.length,
            meta: `${r.members.length}`, body: <MemberList members={r.members} />,
          }))}
        />
      </Section>

      <Section title={t("globetrotterH")} sub={t("globetrotterSub")} count={memberRows.length}>
        <Accordion
          max={Math.max(1, ...memberRows.map((r) => r.total))}
          rows={shownMembers.map((r) => ({
            key: r.m.slug,
            label: r.m.fullName,
            bar: r.total,
            meta: `${r.total}`,
            body: (
              <div className="space-y-2 pt-2 text-sm">
                {r.friendship.size > 0 && (
                  <p><span className="text-muted-foreground">{t("friendshipH")}: </span>{[...r.friendship].sort((a, b) => a.localeCompare(b, "et")).join(", ")}</p>
                )}
                {r.causes.length > 0 && (
                  <p><span className="text-muted-foreground">{t("causesH")}: </span>{r.causes.slice().sort((a, b) => a.localeCompare(b, "et")).join("; ")}</p>
                )}
              </div>
            ),
          }))}
        />
        {memberRows.length > 20 && (
          <button type="button" onClick={() => setAllMembers((v) => !v)} className="mt-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            {allMembers ? t("showLess") : t("showAllN", { n: memberRows.length })}
          </button>
        )}
      </Section>

      <Section title={t("causesH")} sub={t("causesSub")} count={causeRows.length}>
        <Accordion
          max={Math.max(1, ...causeRows.map((r) => r.members.length))}
          rows={causeRows.map((r) => ({
            key: r.label, label: r.label, bar: r.members.length,
            meta: `${r.members.length} · ${r.parties}`, body: <MemberList members={r.members} />,
          }))}
        />
      </Section>
    </>
  );
}
