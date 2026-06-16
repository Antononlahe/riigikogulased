import { pool } from "./db";

/** Minimum scored votes for a descriptor to appear in the default index list. */
export const INDEX_MIN_VOTES = 5;
/** Minimum counted votes on a topic for a member to be ranked. */
export const MEMBER_MIN_VOTES = 3;

export type TopicMemberRow = {
  memberId: number;
  fullName: string;
  slug: string;
  partyShortName: string | null;
  inFaction: boolean;
  counted: number;
  aligned: number;
  defections: number;
};

export type RankedTopicMember = TopicMemberRow & { disciplineScore: number };

/** Pick the locale-appropriate label, falling back to Estonian. */
export function topicLabel(
  row: { nameEt: string; nameEn: string | null },
  locale: string,
): string {
  return locale === "en" && row.nameEn ? row.nameEn : row.nameEt;
}

export function disciplineScore(aligned: number, counted: number): number | null {
  return counted > 0 ? aligned / counted : null;
}

/**
 * Split per-member topic rows into a ranked list (>= MEMBER_MIN_VOTES counted,
 * worst discipline first then most defections) and a count of members who voted
 * on the topic but too few times to rank.
 */
export function splitByThreshold(rows: TopicMemberRow[]): {
  ranked: RankedTopicMember[];
  belowThresholdCount: number;
} {
  const ranked: RankedTopicMember[] = [];
  let belowThresholdCount = 0;
  for (const r of rows) {
    if (r.counted >= MEMBER_MIN_VOTES) {
      ranked.push({ ...r, disciplineScore: r.aligned / r.counted });
    } else if (r.counted > 0) {
      belowThresholdCount += 1;
    }
  }
  ranked.sort(
    (a, b) =>
      a.disciplineScore - b.disciplineScore ||
      b.defections - a.defections ||
      a.fullName.localeCompare(b.fullName),
  );
  return { ranked, belowThresholdCount };
}
