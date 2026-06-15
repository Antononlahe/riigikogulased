import { partyToken } from "@/lib/party";

export function DisciplineBar({
  score,
  shortName,
}: {
  score: number | null;
  shortName: string | null;
}) {
  const token = partyToken(shortName);
  const pct = score === null ? null : Math.round(score * 1000) / 10;
  return (
    <div className="flex items-center justify-end gap-2.5">
      <div className="h-[7px] w-28 overflow-hidden rounded bg-muted" aria-hidden>
        <div
          className="h-full rounded"
          style={{ width: `${pct ?? 0}%`, background: token.fill }}
        />
      </div>
      <span className="w-12 text-right font-semibold tabular-nums">
        {pct === null ? "—" : `${pct.toFixed(1)}%`}
      </span>
    </div>
  );
}
