// Member-page speech panel. Count tiles come from the API's
// pre-computed stats (member_speech_stats). Word totals + cadence + the browse list come
// from the ingested stenogram text (member_speeches) -- a different (smaller) population, so
// they don't reconcile with the count tiles, by design.
import { getTranslations } from "next-intl/server";
import type { SpeechStats } from "@/lib/speeches";
import { getMemberSpeechMeta } from "@/lib/speeches-queries";
import { RATE_FLOOR_DAYS } from "@/lib/speeches";
import { SpeechSearch } from "@/components/speech-search";
import { SpeechBrowse } from "@/components/member/speech-browse";
import { ComparePopover } from "@/components/member/compare-popover";

function Tile({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-serif text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

// Monthly cadence: a pure CSS bar strip (no chart lib). Bars scale to the busiest month;
// the month axis is zero-filled server-side so recess gaps show as empty.
function Cadence({
  data,
  title,
  subtitle,
}: {
  data: { month: string; count: number }[];
  title: string;
  subtitle: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const first = data[0]?.month ?? "";
  const last = data[data.length - 1]?.month ?? "";
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-baseline justify-between">
        <h3 className="font-serif text-sm font-bold">{title}</h3>
        <span className="text-[11px] text-muted-foreground">{subtitle}</span>
      </div>
      <div className="flex h-16 items-end gap-px border-b border-border" aria-hidden="true">
        {data.map((d) => (
          <div
            key={d.month}
            title={`${d.month}: ${d.count}`}
            className="min-h-px flex-1 rounded-t-sm bg-ring/80"
            style={{ height: `${Math.max(2, (d.count / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{first}</span>
        <span>{last}</span>
      </div>
    </div>
  );
}

export async function SpeechPanel({
  stats,
  memberId,
  boardRole,
  mandateStartedOn,
  avgSpeeches,
}: {
  stats: SpeechStats;
  memberId: number;
  boardRole?: string | null;
  mandateStartedOn?: string | null;
  avgSpeeches?: number | null;
}) {
  const t = await getTranslations("memberDetail");
  const meta = await getMemberSpeechMeta(memberId);
  // Presiding officers (juhatus) say a lot of short procedural calls that the speech ingest
  // filters out, so their tallies read low; flag the role so the number isn't misread.
  const board = boardRole === "ESIMEES" || boardRole === "ASEESIMEES" ? boardRole : null;
  // Tenure context: a recent joiner's low counts are expected, not low activity. The headline
  // tenure now lives in the member header; here we only keep the recency flag for the note below.
  const days = mandateStartedOn
    ? Math.floor((Date.now() - Date.parse(mandateStartedOn)) / 86_400_000)
    : null;
  const recent = days != null && days < RATE_FLOOR_DAYS;
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="font-serif text-lg font-bold">{t("speechesTitle")}</h2>
        {avgSpeeches != null && (
          <ComparePopover
            ariaLabel={t("compare.aria")}
            memberLabel={t("compare.member")}
            memberValue={stats.total.toLocaleString("et")}
            othersLabel={t("compare.others")}
            othersValue={Math.round(avgSpeeches).toLocaleString("et")}
            note={t("compare.speechesNote")}
          />
        )}
        {board && (
          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {t(board === "ESIMEES" ? "boardChair" : "boardDeputy")}
          </span>
        )}
      </div>
      <SpeechSearch memberId={memberId} />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label={t("speechesLabel")} value={stats.speeches} />
        <Tile label={t("questionsLabel")} value={stats.questions} />
        <Tile label={t("proceduralLabel")} value={stats.procedural} />
        <Tile label={t("totalLabel")} value={stats.total} />
        {meta && (
          <>
            <Tile
              label={t("wordsTotal")}
              value={meta.totalWords.toLocaleString("et")}
              sub={t("wordsFromSteno")}
            />
            <Tile
              label={t("wordsAvg")}
              value={meta.avgWords.toLocaleString("et")}
              sub={t("wordsPerSpeech")}
            />
          </>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("speechesNote")}</p>
      {board && <p className="mt-1 text-xs text-muted-foreground">{t("boardNote")}</p>}
      {recent && <p className="mt-1 text-xs text-muted-foreground">{t("tenureNote")}</p>}
      {meta && meta.cadence.length > 1 && (
        <Cadence data={meta.cadence} title={t("cadenceTitle")} subtitle={t("cadenceSub")} />
      )}
      {meta && (
        <SpeechBrowse memberId={memberId} total={meta.speechCount} years={meta.years} types={meta.types} />
      )}
    </section>
  );
}
