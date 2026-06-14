import { getTranslations, setRequestLocale } from "next-intl/server";
import { getMemberDiscipline, type MemberDisciplineRow } from "@/lib/queries";

export const revalidate = 3600;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("members");
  const site = await getTranslations("site");
  const footer = await getTranslations("footer");

  let rows: MemberDisciplineRow[] = [];
  let dbError: string | null = null;
  try {
    rows = await getMemberDiscipline();
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{site("title")}</h1>
        <p className="mt-2 text-neutral-600">{site("tagline")}</p>
      </header>

      <section>
        <h2 className="text-xl font-semibold">{t("heading")}</h2>
        <p className="mt-1 text-sm text-neutral-600">{t("subheading")}</p>

        {dbError ? (
          <p className="mt-6 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            {t("empty")}
            <br />
            <span className="font-mono text-xs">{dbError}</span>
          </p>
        ) : rows.length === 0 ? (
          <p className="mt-6 text-sm text-neutral-600">{t("empty")}</p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-neutral-100 text-left">
                <tr>
                  <th className="px-3 py-2">{t("table.name")}</th>
                  <th className="px-3 py-2">{t("table.party")}</th>
                  <th className="px-3 py-2 text-right">{t("table.score")}</th>
                  <th className="px-3 py-2 text-right">{t("table.countedVotes")}</th>
                  <th className="px-3 py-2 text-right">{t("table.defections")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.memberId} className="border-t border-neutral-100">
                    <td className="px-3 py-2">{r.fullName}</td>
                    <td className="px-3 py-2 text-neutral-600">
                      {r.partyShortName ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.disciplineScore == null
                        ? "—"
                        : `${(r.disciplineScore * 100).toFixed(1)}%`}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.countedVotes}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.defections}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="mt-12 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
        <p>{footer("source")}</p>
      </footer>
    </main>
  );
}
