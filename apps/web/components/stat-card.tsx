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
  href: string; // where THIS row goes (sole holder -> member page, tie/vote -> leaderboard)
};

// One row inside a hub card: its own link, so the two ends of a metric go to their own
// targets and hover highlights just the row, not the whole card.
function Row({ row, className }: { row: StatCardRow; className: string }) {
  const { eyebrow, name, value, sub, party, avatar, href } = row;
  return (
    <Link
      href={href}
      className={`group flex items-start gap-3 p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground ${className}`}
    >
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
    </Link>
  );
}

// One hub card: the metric's top holder, and optionally the opposite end (`second`) below a
// divider -- most and least in one card, each row linking to its own target. `footer` is the
// metric's own stat page ("see all"), so person rows can keep linking to the person without
// hiding the leaderboard behind them.
export function StatCard({
  top,
  second,
  footer,
}: {
  top: StatCardRow;
  second?: StatCardRow | null;
  footer?: { label: string; href: string } | null;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card">
      <Row row={top} className={second || footer ? "rounded-t-lg" : "rounded-lg"} />
      {second && (
        <div className="border-t border-border">
          <Row row={second} className={footer ? "" : "rounded-b-lg"} />
        </div>
      )}
      {footer && (
        <Link
          href={footer.href}
          className="rounded-b-lg border-t border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground"
        >
          {footer.label} →
        </Link>
      )}
    </div>
  );
}
