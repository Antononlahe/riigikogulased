// v0.5 speeches (REMOVABLE FEATURE). Pure helpers + types; queries in speeches-queries.ts.
// Counts come from the API's pre-computed /api/statistics/speeches/plenary (member_speech_stats).

export type SpeakerRow = {
  memberId: number;
  fullName: string;
  slug: string;
  partyShortName: string | null;
  photoThumbPath: string | null;
  active: boolean;
  speeches: number;
  questions: number;
  procedural: number;
  total: number;
};

export type SpeechStats = {
  speeches: number;
  questions: number;
  procedural: number;
  total: number;
};

export type SpeakerSortKey = "total" | "speeches" | "questions" | "procedural";
export type SortDir = "asc" | "desc";

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
