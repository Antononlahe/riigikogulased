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

export type SpeechSearchResult = { hits: SpeechHit[]; total: number };

/** Full-text search over stenogram speeches: the whole corpus by default, optionally
 *  narrowed to one member (member-page box) or one party (signature-word drill-down).
 *  Newest first, paged by `offset`; `total` is the full match count so the client can
 *  show "N found" and a load-more button. ts_headline runs only on the returned page
 *  (the inner query sorts/limits first — headline over every match of a common word
 *  would dominate the query). */
export async function searchSpeeches(
  q: string,
  opts: { memberId?: number; party?: string; limit?: number; offset?: number } = {},
): Promise<SpeechSearchResult> {
  const query = q.trim();
  if (query.length < 2) return { hits: [], total: 0 };
  const like = `%${query.replace(/[%_\\]/g, "\\$&")}%`;
  const headlineOpts =
    `StartSel=${HL_START}, StopSel=${HL_END}, ` +
    "MaxFragments=2, FragmentDelimiter= … , MinWords=5, MaxWords=20, ShortWord=2";
  // Prefix query so inflections/compounds highlight; empty falls back to plain lexeme highlight.
  const hq = prefixHighlightQuery(query);
  const { rows } = await pool.query(
    `
    WITH ql AS (SELECT websearch_to_tsquery('simple', $1) AS q),
    page AS (
      SELECT ms.speech_key, ms.spoken_at, ms.sitting_date, ms.sitting_type,
             ms.agenda_title, ms.steno_link, ms.text,
             m.full_name, m.slug, mcp.party_short_name,
             count(*) OVER ()::int AS total
      FROM member_speeches ms
      CROSS JOIN ql
      JOIN members m ON m.id = ms.member_id
      LEFT JOIN member_current_party mcp ON mcp.member_id = ms.member_id
      WHERE ($6::int IS NULL OR ms.member_id = $6)
        AND ($7::text IS NULL OR mcp.party_short_name = $7)
        AND (ms.search @@ ql.q OR ms.text ILIKE $2)
      ORDER BY ms.spoken_at DESC NULLS LAST, ms.speech_key
      LIMIT $3 OFFSET $8
    )
    SELECT page.speech_key AS "speechKey",
           page.spoken_at AS "spokenAt",
           page.sitting_date::text AS "sittingDate",
           page.sitting_type AS "sittingType",
           page.agenda_title AS "agendaTitle",
           page.steno_link AS link,
           page.full_name AS "fullName", page.slug,
           page.party_short_name AS "partyShortName",
           page.total,
           ts_headline('simple', page.text,
             CASE WHEN $5 = '' THEN plainto_tsquery('simple', $1) ELSE to_tsquery('simple', $5) END,
             $4) AS snippet
    FROM page
    ORDER BY page.spoken_at DESC NULLS LAST, page.speech_key
    `,
    [
      query,
      like,
      opts.limit ?? 20,
      headlineOpts,
      hq,
      opts.memberId ?? null,
      opts.party ?? null,
      Math.max(opts.offset ?? 0, 0),
    ],
  );
  const total = (rows[0]?.total as number | undefined) ?? 0;
  const hits = rows.map(({ total: _t, ...r }) => ({
    ...r,
    spokenAt: r.spokenAt ? new Date(r.spokenAt).toISOString() : null,
  })) as SpeechHit[];
  return { hits, total };
}
