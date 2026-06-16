import { getTranslations } from "next-intl/server";
import type { TopicBillRow } from "@/lib/topics-queries";

export async function TopicBills({ bills }: { bills: TopicBillRow[] }) {
  const t = await getTranslations("topics");
  if (bills.length === 0) return null;
  return (
    <section>
      <h2 className="font-serif text-lg font-bold">{t("bills")}</h2>
      <ul className="mt-3 divide-y divide-border rounded-md border border-border">
        {bills.map((b) => (
          <li key={b.draftUuid} className="px-4 py-2.5">
            <p className="font-medium">{b.draftTitle ?? b.draftMark ?? b.draftUuid}</p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {b.firstDate.slice(0, 10)} · {b.votes} {t("billVotes")} · {b.defections} {t("billDefections")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
