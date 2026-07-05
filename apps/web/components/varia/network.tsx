"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { PartyBadge } from "@/components/party-badge";
import { PARTY_ORDER } from "@/lib/party";
import { friendshipCountry, type CaucusRow, type Globetrotter } from "@/lib/varia";

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="font-serif text-xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const sortParties = (a: string, b: string) => {
  const ia = PARTY_ORDER.indexOf(a as never), ib = PARTY_ORDER.indexOf(b as never);
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
};

export function FriendshipByCountry({ groups }: { groups: CaucusRow[] }) {
  const t = useTranslations("varia");
  const rows = useMemo(() => {
    const by = new Map<string, number>();
    for (const g of groups) {
      const c = friendshipCountry(g.name);
      by.set(c, (by.get(c) ?? 0) + g.count);
    }
    return [...by.entries()].map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "et"));
  }, [groups]);
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Section title={t("friendshipH")} sub={t("friendshipSub")}>
      <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-sm" title={r.label}>{r.label}</span>
            <span className="relative h-4 flex-1 rounded-sm bg-muted">
              <span className="absolute inset-y-0 left-0 rounded-sm bg-foreground/70" style={{ width: `${(r.count / max) * 100}%` }} />
            </span>
            <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{r.count}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function Globetrotters({ rows }: { rows: Globetrotter[] }) {
  const t = useTranslations("varia");
  return (
    <Section title={t("globetrotterH")} sub={t("globetrotterSub")}>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.slug} className="flex items-center gap-3">
            <Link href={`/members/${r.slug}`} className="w-52 shrink-0 truncate text-sm font-semibold hover:underline">
              {r.fullName}
            </Link>
            <PartyBadge shortName={r.partyShortName} />
            <span className="ml-auto text-sm tabular-nums text-muted-foreground">{r.groups} {t("groups")}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function CauseCaucuses({ causes }: { causes: CaucusRow[] }) {
  const t = useTranslations("varia");
  return (
    <Section title={t("causesH")} sub={t("causesSub")}>
      <ul className="space-y-2">
        {causes.map((c) => (
          <li key={c.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border pb-2 last:border-0">
            <span className="text-sm font-medium">{c.name}</span>
            <span className="flex gap-1">
              {[...c.parties].sort(sortParties).map((p) => (
                <PartyBadge key={p} shortName={p} />
              ))}
            </span>
            <span className="ml-auto text-sm tabular-nums text-muted-foreground">
              {c.count} {t("members")} · {c.parties.length} {t("parties")}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
