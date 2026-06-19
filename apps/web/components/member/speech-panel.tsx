// v0.5-B member-page speech panel (REMOVABLE FEATURE). Counts from the API's pre-computed
// speech statistics (member_speech_stats). Word totals / cadence / topics are out of scope
// (need /api/steno ingestion).
import { getTranslations } from "next-intl/server";
import type { SpeechStats } from "@/lib/speeches";
import { SpeechSearch } from "@/components/member/speech-search";

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-serif text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

export async function SpeechPanel({ stats, memberId }: { stats: SpeechStats; memberId: number }) {
  const t = await getTranslations("memberDetail");
  return (
    <section>
      <h2 className="mb-3 font-serif text-lg font-bold">{t("speechesTitle")}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label={t("speechesLabel")} value={stats.speeches} />
        <Tile label={t("questionsLabel")} value={stats.questions} />
        <Tile label={t("proceduralLabel")} value={stats.procedural} />
        <Tile label={t("totalLabel")} value={stats.total} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("speechesNote")}</p>
      <SpeechSearch memberId={memberId} />
    </section>
  );
}
