import { Link } from "@/i18n/routing";
import { PartyBadge } from "@/components/party-badge";
import { MemberAvatar } from "@/components/member-avatar";

// One hub card: an eyebrow label, the subject as headline (member / faction / vote), a party
// badge and the bold stat. Whole card links to the full page. `avatar` is set only for a
// person; a faction shows just its badge, a vote neither.
export function StatCard({
  eyebrow,
  href,
  name,
  value,
  party,
  avatar,
}: {
  eyebrow: string;
  href: string;
  name: string;
  value: string;
  party?: string | null;
  avatar?: { fullName: string; photoThumbPath: string | null; shortName: string | null };
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
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
      </div>
    </Link>
  );
}
