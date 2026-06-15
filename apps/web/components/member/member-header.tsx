import { useTranslations } from "next-intl";
import type { MemberRecord } from "@/lib/queries";
import { MemberAvatar } from "@/components/member-avatar";
import { PartyBadge } from "@/components/party-badge";

export function MemberHeader({ member }: { member: MemberRecord }) {
  const t = useTranslations("memberDetail");
  const showChip = member.partyShortName !== null && !member.inFaction;
  return (
    <header className="flex items-center gap-4">
      <MemberAvatar
        fullName={member.fullName}
        photoThumbPath={member.photoThumbPath}
        shortName={member.partyShortName}
      />
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-tight">{member.fullName}</h1>
        <div className="mt-1 flex items-center gap-2">
          <PartyBadge shortName={member.partyShortName} name={member.partyName} />
          {showChip && (
            <span className="rounded-sm bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
              {t("notInFaction", { party: member.partyName ?? member.partyShortName })}
            </span>
          )}
          {member.partyShortName === null && (
            <span className="rounded-sm bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
              {t("unaffiliated")}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
