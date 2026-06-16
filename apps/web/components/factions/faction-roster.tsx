import { getTranslations } from "next-intl/server";
import { MemberAvatar } from "@/components/member-avatar";
import { DisciplineBar } from "@/components/discipline-bar";
import { Link } from "@/i18n/routing";
import { mostLeastLoyal, type RosterMember } from "@/lib/factions";

export async function FactionRoster({ members }: { members: RosterMember[] }) {
  const t = await getTranslations("factions");
  const { mostId, leastId } = mostLeastLoyal(members);

  return (
    <section>
      <h2 className="mb-3 font-serif text-lg font-bold">{t("roster")}</h2>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <tbody>
            {members.map((m) => (
              <tr
                key={m.memberId}
                className={`border-b border-border last:border-0 hover:bg-secondary ${m.active ? "" : "opacity-55"}`}
              >
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-3 font-semibold">
                    <MemberAvatar
                      fullName={m.fullName}
                      photoThumbPath={m.photoThumbPath}
                      shortName={m.partyShortName}
                    />
                    <Link href={`/members/${m.slug}`} className="hover:underline">
                      {m.fullName}
                    </Link>
                    {m.memberId === mostId && (
                      <span className="rounded-sm bg-secondary px-1 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t("mostLoyal")}
                      </span>
                    )}
                    {m.memberId === leastId && (
                      <span className="rounded-sm bg-secondary px-1 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t("leastLoyal")}
                      </span>
                    )}
                    {!m.inFaction && (
                      <span className="text-[10px] text-muted-foreground">{t("notInFaction")}</span>
                    )}
                    {!m.active && (
                      <span className="rounded-sm bg-secondary px-1 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t("former")}
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <DisciplineBar score={m.disciplineScore} shortName={m.partyShortName} />
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {m.defections}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
