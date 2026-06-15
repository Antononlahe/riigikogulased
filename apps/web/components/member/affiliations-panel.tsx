import { useTranslations } from "next-intl";
import type { Affiliation, MemberRecord } from "@/lib/queries";

export function AffiliationsPanel({
  member,
  committees,
  districts,
}: {
  member: MemberRecord;
  committees: Affiliation[];
  districts: Affiliation[];
}) {
  const t = useTranslations("memberDetail");
  const birthYear = member.dateOfBirth ? member.dateOfBirth.slice(0, 4) : null;
  const seniorityYears = member.senorityDays != null ? Math.floor(member.senorityDays / 365) : null;
  return (
    <aside className="space-y-6 text-sm">
      <Block title={t("districts")} items={districts.map((d) => d.name)} />
      <Block title={t("committees")} items={committees.map((c) => c.name)} />
      <dl className="space-y-1 text-muted-foreground">
        {birthYear && <Row k={t("born")} v={birthYear} />}
        {seniorityYears != null && <Row k={t("seniority")} v={t("years", { n: seniorityYears })} />}
        {member.mandateStartedOn && <Row k={t("mandate")} v={member.mandateStartedOn.slice(0, 10)} />}
        {member.email && <Row k={t("email")} v={member.email} />}
      </dl>
    </aside>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">{title}</h3>
      <ul className="mt-1 space-y-0.5">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{k}</dt>
      <dd className="text-foreground">{v}</dd>
    </div>
  );
}
