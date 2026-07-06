import { Link } from "@/i18n/routing";
import { PartyBadge } from "@/components/party-badge";
import { MemberAvatar } from "@/components/member-avatar";

export type StatCardRow = {
  eyebrow: string;
  name: string;
  value: string;
  sub?: string; // one-line plain-language context ("voted against the line 12 times of 480")
  party?: string | null;
  avatar?: { fullName: string; photoThumbPath: string | null; shortName: string | null };
};

// One row inside a hub card: eyebrow label, subject headline, party badge, bold stat, and an
// optional muted context line. `avatar` is set only for a person; a vote shows neither.
function Row({ eyebrow, name, value, sub, party, avatar }: StatCardRow) {
  return (
    <div className="flex items-start gap-3">
      {avatar && <MemberAvatar {...avatar} />}
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {eyebrow}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="truncate font-serif text-base font-bold leading-tight group-hover:underline">
            {name}
          </span>
          {party && <PartyBadge shortName={party} />}
        </div>
        <div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

// One hub card: the metric's top holder, and optionally the opposite end (`second`) below a
// divider -- most and least in one card. Whole card links to the full page.
export function StatCard({
  href,
  second,
  ...top
}: StatCardRow & { href: string; second?: StatCardRow | null }) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
    >
      <Row {...top} />
      {second && (
        <div className="border-t border-border pt-3">
          <Row {...second} />
        </div>
      )}
    </Link>
  );
}
