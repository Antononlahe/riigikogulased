// v0.5 speeches (REMOVABLE FEATURE). Pure helpers + types; queries in speeches-queries.ts.
// Counts come from the API's pre-computed /api/statistics/speeches/plenary (member_speech_stats).

export type SpeakerRow = {
  memberId: number;
  fullName: string;
  slug: string;
  partyShortName: string | null;
  photoThumbPath: string | null;
  active: boolean;
  boardRole: string | null; // ESIMEES | ASEESIMEES | null (Riigikogu juhatus)
  speeches: number;
  questions: number;
  procedural: number;
  total: number;
  // Word totals from the ingested stenogram corpus (member_speeches), 0 if none ingested.
  totalWords: number;
  avgWords: number;
};

/** Compact number for big counts: 100000 -> "100k", 1234567 -> "1.2M". Leaves <1000 as-is. */
export function compactNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "k";
  return String(n);
}

export type SpeechStats = {
  speeches: number;
  questions: number;
  procedural: number;
  total: number;
};

export type SpeakerSortKey =
  | "total"
  | "speeches"
  | "questions"
  | "procedural"
  | "totalWords"
  | "avgWords";
export type SortDir = "asc" | "desc";

// --- member-page word totals / cadence / browse list (from member_speeches) ---
// NOTE: member_speeches is the stenogram corpus we ingested (member-attributed, >=60 chars),
// a different population from member_speech_stats' API counts -- so word totals don't
// reconcile with the count tiles, and that's expected.

export type SpeechMeta = {
  speechCount: number;
  totalWords: number;
  avgWords: number;
  cadence: { month: string; count: number }[]; // zero-filled month axis (recess gaps show)
  years: number[]; // years present, desc
  types: string[]; // sitting_type values present
};

export type SpeechBrowseItem = {
  speechKey: string;
  spokenAt: string | null;
  sittingDate: string | null;
  sittingType: string | null;
  agendaTitle: string | null;
  link: string | null;
  opening: string;
  wordCount: number;
};

export type SpeechSort = "recent" | "oldest" | "longest";

// Whitelist: ORDER BY is interpolated into SQL, so it must never come from raw user input.
const SPEECH_ORDER: Record<SpeechSort, string> = {
  recent: "spoken_at DESC NULLS LAST",
  oldest: "spoken_at ASC NULLS LAST",
  longest: "length(text) DESC",
};

export function speechBrowseOrderBy(sort: string): string {
  return SPEECH_ORDER[sort as SpeechSort] ?? SPEECH_ORDER.recent;
}

export function speakerMetric(r: SpeakerRow, key: SpeakerSortKey): number {
  return r[key];
}

/** Sort a copy of rows; ties break by Estonian-collated name. */
export function sortSpeakers(
  rows: SpeakerRow[],
  key: SpeakerSortKey,
  dir: SortDir,
): SpeakerRow[] {
  const asc = dir === "asc";
  return [...rows].sort((a, b) => {
    const av = speakerMetric(a, key);
    const bv = speakerMetric(b, key);
    if (av !== bv) return asc ? av - bv : bv - av;
    return a.fullName.localeCompare(b.fullName, "et");
  });
}
