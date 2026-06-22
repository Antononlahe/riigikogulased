import { pool } from "./db";
import {
  speechBrowseOrderBy,
  type SpeakerRow,
  type SpeechStats,
  type SpeechMeta,
  type SpeechBrowseItem,
} from "./speeches";

/** All members with recorded speech stats, for the leaderboard (A). Active members only
 *  (the API's plenary speech statistics cover the current roster). */
export async function getSpeechLeaderboard(): Promise<SpeakerRow[]> {
  const { rows } = await pool.query(`
    SELECT m.id AS "memberId", m.full_name AS "fullName", m.slug,
           mcp.party_short_name AS "partyShortName", m.photo_thumb_path AS "photoThumbPath",
           m.active,
           s.speeches, s.questions, s.procedural, s.total
    FROM member_speech_stats s
    JOIN members m ON m.id = s.member_id
    LEFT JOIN member_current_party mcp ON mcp.member_id = m.id
    ORDER BY s.total DESC, m.full_name ASC
  `);
  return rows as SpeakerRow[];
}

/** Speech counts for one member, or null if none recorded (member-page panel, B). */
export async function getMemberSpeechStats(memberId: number): Promise<SpeechStats | null> {
  const { rows } = await pool.query(
    `SELECT speeches, questions, procedural, total
       FROM member_speech_stats WHERE member_id = $1`,
    [memberId],
  );
  return (rows[0] as SpeechStats | undefined) ?? null;
}

/** Word totals, monthly cadence, and filter options for one member's stenogram speeches
 *  (member_speeches). Null if we have no speech text for them. */
export async function getMemberSpeechMeta(memberId: number): Promise<SpeechMeta | null> {
  const [agg, cadence] = await Promise.all([
    pool.query(
      `SELECT count(*)::int AS "speechCount",
              coalesce(sum(array_length(string_to_array(btrim(text), ' '), 1)), 0)::int AS "totalWords",
              coalesce(array_agg(DISTINCT extract(year FROM spoken_at)::int)
                       FILTER (WHERE spoken_at IS NOT NULL), '{}') AS years,
              coalesce(array_agg(DISTINCT sitting_type)
                       FILTER (WHERE sitting_type IS NOT NULL), '{}') AS types
         FROM member_speeches WHERE member_id = $1`,
      [memberId],
    ),
    pool.query(
      `WITH b AS (
         SELECT date_trunc('month', min(spoken_at)) AS lo, date_trunc('month', max(spoken_at)) AS hi
           FROM member_speeches WHERE member_id = $1 AND spoken_at IS NOT NULL
       )
       SELECT to_char(g, 'YYYY-MM') AS month,
              (SELECT count(*) FROM member_speeches ms
                WHERE ms.member_id = $1 AND date_trunc('month', ms.spoken_at) = g)::int AS count
         FROM b, generate_series(b.lo, b.hi, interval '1 month') g
        WHERE b.lo IS NOT NULL
        ORDER BY g`,
      [memberId],
    ),
  ]);
  const a = agg.rows[0] as
    | { speechCount: number; totalWords: number; years: number[]; types: string[] }
    | undefined;
  if (!a || a.speechCount === 0) return null;
  return {
    speechCount: a.speechCount,
    totalWords: a.totalWords,
    avgWords: Math.round(a.totalWords / a.speechCount),
    cadence: cadence.rows as { month: string; count: number }[],
    years: [...a.years].sort((x, y) => y - x),
    types: a.types,
  };
}

/** A page of a member's speeches for the browse list, with optional year/sitting-type
 *  filters and sort. `sort` is whitelisted into ORDER BY (never raw input). */
export async function browseMemberSpeeches(
  memberId: number,
  opts: { sort?: string; year?: number | null; type?: string | null; offset?: number },
): Promise<SpeechBrowseItem[]> {
  const orderBy = speechBrowseOrderBy(opts.sort ?? "recent");
  const offset = Math.max(opts.offset ?? 0, 0);
  const { rows } = await pool.query(
    `SELECT speech_key AS "speechKey", spoken_at AS "spokenAt",
            sitting_date::text AS "sittingDate", sitting_type AS "sittingType",
            agenda_title AS "agendaTitle", steno_link AS link,
            btrim(left(text, 240)) AS opening,
            array_length(string_to_array(btrim(text), ' '), 1) AS "wordCount"
       FROM member_speeches
      WHERE member_id = $1
        AND ($2::int IS NULL OR extract(year FROM spoken_at) = $2)
        AND ($3::text IS NULL OR sitting_type = $3)
      ORDER BY ${orderBy}
      LIMIT 30 OFFSET $4`,
    [memberId, opts.year ?? null, opts.type ?? null, offset],
  );
  return rows.map((r) => ({
    ...r,
    spokenAt: r.spokenAt ? new Date(r.spokenAt).toISOString() : null,
  })) as SpeechBrowseItem[];
}
