import { pool } from "./db";
import { HL_START, HL_END, type SpeechHit } from "./speech-search";

// Match strategy: the `search` tsvector indexes Vabamorf base-form LEMMAS, so a base-form
// query ("kool") matches every inflection in the corpus. The web app can't lemmatise the
// query itself (no Estonian lemmatiser in Node), so an inflected query ("koolis") won't hit
// the lemma index — `pg_trgm` ILIKE over the raw text is the fallback that still finds it.
// Highlighting uses ts_headline with non-HTML sentinel markers; the client wraps them in
// <mark> as React text nodes (XSS-safe). ts_headline only highlights exact forms in the raw
// text; lemma-only matches fall back to the opening fragment, which is acceptable.

export async function searchMemberSpeeches(
  memberId: number,
  q: string,
  limit = 20,
): Promise<SpeechHit[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const like = `%${query.replace(/[%_\\]/g, "\\$&")}%`;
  const headlineOpts =
    `StartSel=${HL_START}, StopSel=${HL_END}, ` +
    "MaxFragments=2, FragmentDelimiter= … , MinWords=5, MaxWords=20, ShortWord=2";
  const { rows } = await pool.query(
    `
    WITH ql AS (SELECT websearch_to_tsquery('simple', $2) AS q)
    SELECT speech_key AS "speechKey",
           spoken_at AS "spokenAt",
           sitting_date::text AS "sittingDate",
           sitting_type AS "sittingType",
           agenda_title AS "agendaTitle",
           steno_link AS link,
           ts_headline('simple', text, plainto_tsquery('simple', $2), $5) AS snippet
    FROM member_speeches, ql
    WHERE member_id = $1
      AND (search @@ ql.q OR text ILIKE $3)
    ORDER BY (search @@ ql.q) DESC,
             ts_rank_cd(search, ql.q) DESC,
             spoken_at DESC NULLS LAST
    LIMIT $4
    `,
    [memberId, query, like, limit, headlineOpts],
  );
  return rows.map((r) => ({
    ...r,
    spokenAt: r.spokenAt ? new Date(r.spokenAt).toISOString() : null,
  })) as SpeechHit[];
}
