import { pool } from "./db";
import type { SpeakerRow, SpeechStats } from "./speeches";

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
