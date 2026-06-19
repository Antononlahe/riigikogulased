import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { partyToken } from "@/lib/party";
import type { CommitteeMatrix } from "@/lib/committees-queries";

// Cohesion clusters tightly (≈98–100%), so absolute 0–100 shading would look uniform.
// Shade each cell by its position within the observed cohesion range instead — green for
// the more-cohesive end, a faint red for the least. Purely presentational.
function shade(cohesion: number | null, min: number, max: number): string {
  if (cohesion === null) return "var(--secondary)";
  const span = max - min;
  const norm = span > 0 ? (cohesion - min) / span : 1;
  if (norm < 0.18) return `rgba(228,0,43,${(0.22 - norm).toFixed(3)})`;
  return `rgba(16,160,91,${(0.12 + norm * 0.34).toFixed(3)})`;
}

export async function CommitteeMatrix({ matrix }: { matrix: CommitteeMatrix }) {
  const t = await getTranslations("statistika");
  const values: number[] = [];
  for (const c of matrix.committees) {
    for (const p of matrix.parties) {
      const cell = matrix.cells[c.committeeId]?.[p];
      if (cell?.cohesion != null) values.push(cell.cohesion);
    }
  }
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {t("committee")}
            </th>
            {matrix.parties.map((p) => (
              <th
                key={p}
                className="px-2 py-2 text-center text-xs font-bold"
                style={{ color: partyToken(p).ink }}
              >
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.committees.map((c) => (
            <tr key={c.committeeId} className="border-t border-border">
              <td className="px-3 py-2 font-medium">
                <Link href={`/statistika/komisjonid/${c.slug}`} className="hover:underline">
                  {c.name}
                </Link>
              </td>
              {matrix.parties.map((p) => {
                const cell = matrix.cells[c.committeeId]?.[p];
                const v = cell?.cohesion ?? null;
                return (
                  <td
                    key={p}
                    className="border-l border-border px-2 py-2 text-center tabular-nums"
                    style={{ background: shade(v, min, max) }}
                    title={cell ? `${cell.memberCount} ${t("members")}` : t("notOnCommittee")}
                  >
                    {v === null ? (
                      <span className="text-muted-foreground">∅</span>
                    ) : (
                      (Math.round(v * 1000) / 10).toFixed(1)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
        <span>{t("matrixLess")}</span>
        <i className="inline-block h-3 w-3 rounded-sm" style={{ background: "rgba(228,0,43,.18)" }} />
        <i className="inline-block h-3 w-3 rounded-sm" style={{ background: "rgba(16,160,91,.18)" }} />
        <i className="inline-block h-3 w-3 rounded-sm" style={{ background: "rgba(16,160,91,.42)" }} />
        <span>{t("matrixMore")}</span>
      </div>
    </div>
  );
}
