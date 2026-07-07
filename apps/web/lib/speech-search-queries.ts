import { pool } from "./db";
import { HL_START, HL_END, prefixHighlightQuery, type SpeechHit } from "./speech-search";

// Match strategy: the `search` tsvector indexes Vabamorf base-form LEMMAS, so a base-form
// query ("kool") matches every inflection in the corpus. The web app can't lemmatise the
// query itself (no Estonian lemmatiser in Node), so an inflected query ("koolis") won't hit
// the lemma index — `pg_trgm` ILIKE over the raw text is the fallback that still finds it
// (trigram-indexed since migration 0026, so the corpus-wide scan is indexable).
// Highlighting uses ts_headline with non-HTML sentinel markers; the client wraps them in
// <mark> as React text nodes (XSS-safe). ts_headline only highlights exact forms in the raw
// text; lemma-only matches fall back to the opening fragment, which is acceptable.

/** Full-text search over stenogram speeches: the whole corpus by default, optionally
 *  narrowed to one member (member-page box) or one party (signature-word drill-down). */
export async function searchSpeeches(
  q: string,
  opts: { memberId?: number; party?: string; limit?: number } = {},
): Promise<SpeechHit[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const like = `%${query.replace(/[%_\\]/g, "\\$&")}%`;
  const headlineOpts =
    `StartSel=${HL_START}, StopSel=${HL_END}, ` +
    "MaxFragments=2, FragmentDelimiter= … , MinWords=5, MaxWords=20, ShortWord=2";
  // Prefix query so inflections/compounds highlight; empty falls back to plain lexeme highlight.
  const hq = prefixHighlightQuery(query);
  const { rows } = await pool.query(
    `
    WITH ql AS (SELECT websearch_to_tsquery('simple', $1) AS q)
    SELECT ms.speech_key AS "speechKey",
           ms.spoken_at AS "spokenAt",
           ms.sitting_date::text AS "sittingDate",
           ms.sitting_type AS "sittingType",
           ms.agenda_title AS "agendaTitle",
           ms.steno_link AS link,
           m.full_name AS "fullName", m.slug,
           mcp.party_short_name AS "partyShortName",
           ts_headline('simple', ms.text,
             CASE WHEN $5 = '' THEN plainto_tsquery('simple', $1) ELSE to_tsquery('simple', $5) END,
             $4) AS snippet
    FROM member_speeches ms
    CROSS JOIN ql
    JOIN members m ON m.id = ms.member_id
    LEFT JOIN member_current_party mcp ON mcp.member_id = ms.member_id
    WHERE ($6::int IS NULL OR ms.member_id = $6)
      AND ($7::text IS NULL OR mcp.party_short_name = $7)
      AND (ms.search @@ ql.q OR ms.text ILIKE $2)
    ORDER BY (ms.search @@ ql.q) DESC,
             ts_rank_cd(ms.search, ql.q) DESC,
             ms.spoken_at DESC NULLS LAST
    LIMIT $3
    `,
    [query, like, opts.limit ?? 20, headlineOpts, hq, opts.memberId ?? null, opts.party ?? null],
  );
  return rows.map((r) => ({
    ...r,
    spokenAt: r.spokenAt ? new Date(r.spokenAt).toISOString() : null,
  })) as SpeechHit[];
}
