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
  daysInTerm: number | null; // days since mandate start (this term); null if unknown
  // Discipline figures for the detail panel (from member_discipline); null if not scored.
  counted: number | null;
  aligned: number | null;
  defections: number | null;
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
  | "avgWords"
  | "tenure"; // months in this term (context column; never normalized)
export type SortDir = "asc" | "desc";

// "abs" = raw counts; "rate" = per-month, normalized by tenure (days in this term).
export type SpeakerMode = "abs" | "rate";

export const DAYS_PER_MONTH = 30.44;
// Below this many days served, a per-month rate is noise (tiny denominator), so we compute it
// but don't rank by it -- such members are parked at the bottom and flagged. ~3 months.
export const RATE_FLOOR_DAYS = 90;

// Volume metrics that scale with time, so dividing by tenure is meaningful. avgWords is already
// a per-speech ratio and "tenure" is the denominator itself -- neither is normalized.
const NORMALIZABLE = new Set<SpeakerSortKey>([
  "total",
  "speeches",
  "questions",
  "procedural",
  "totalWords",
]);

export function isNormalizable(key: SpeakerSortKey): boolean {
  return NORMALIZABLE.has(key);
}

/** A member has enough tenure for a per-month rate to be trustworthy. */
export function isRateEligible(r: SpeakerRow): boolean {
  return r.daysInTerm != null && r.daysInTerm >= RATE_FLOOR_DAYS;
}

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

/** Numeric value for a column under a mode. In "rate" mode, normalizable metrics become
 *  per-month (value / months served); "tenure" returns months; everything else stays raw. */
export function speakerMetric(
  r: SpeakerRow,
  key: SpeakerSortKey,
  mode: SpeakerMode = "abs",
): number {
  if (key === "tenure") return r.daysInTerm != null ? r.daysInTerm / DAYS_PER_MONTH : 0;
  const raw = r[key];
  if (mode === "rate" && isNormalizable(key) && r.daysInTerm && r.daysInTerm > 0) {
    return raw / (r.daysInTerm / DAYS_PER_MONTH);
  }
  return raw;
}

/** Sort a copy of rows; ties break by Estonian-collated name. In "rate" mode on a normalizable
 *  metric, sub-floor (low-tenure) members are parked at the bottom regardless of direction --
 *  their rate is shown but not ranked. */
export function sortSpeakers(
  rows: SpeakerRow[],
  key: SpeakerSortKey,
  dir: SortDir,
  mode: SpeakerMode = "abs",
): SpeakerRow[] {
  const asc = dir === "asc";
  const park = mode === "rate" && isNormalizable(key);
  return [...rows].sort((a, b) => {
    if (park) {
      const ea = isRateEligible(a);
      const eb = isRateEligible(b);
      if (ea !== eb) return ea ? -1 : 1; // eligible always first
    }
    const av = speakerMetric(a, key, mode);
    const bv = speakerMetric(b, key, mode);
    if (av !== bv) return asc ? av - bv : bv - av;
    return a.fullName.localeCompare(b.fullName, "et");
  });
}
