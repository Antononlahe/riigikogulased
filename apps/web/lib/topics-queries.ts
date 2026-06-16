import { pool } from "./db";
import type { TopicMemberRow } from "./topics";

export type TopicIndexRow = {
  edid: number;
  nameEt: string;
  nameEn: string | null;
  fieldEt: string | null;
  fieldEn: string | null;
  votes: number;
  defections: number;
};

/**
 * Every descriptor with >= 1 scored vote, plus its scored-vote count, total
 * defection ballots, and broad-field labels (null when the rollup is missing).
 * Sorted by vote volume. The index page shows >= INDEX_MIN_VOTES by default and
 * lets search reach the rest.
 */
export async function getTopicIndex(): Promise<TopicIndexRow[]> {
  const { rows } = await pool.query(`
    WITH scored AS (
      SELECT DISTINCT vt.vote_id, vt.descriptor_edid
      FROM vote_topics vt
      JOIN member_vote_alignment mva ON mva.vote_id = vt.vote_id
      WHERE mva.party_majority_choice IS NOT NULL
        AND mva.member_choice IN ('yes','no','abstain') AND NOT mva.is_procedural
    ),
    counts AS (
      SELECT descriptor_edid, COUNT(*) AS votes FROM scored GROUP BY descriptor_edid
    ),
    defs AS (
      SELECT vt.descriptor_edid, COUNT(*) AS defections
      FROM member_vote_alignment mva
      JOIN vote_topics vt ON vt.vote_id = mva.vote_id
      WHERE mva.party_majority_choice IS NOT NULL
        AND mva.member_choice IN ('yes','no','abstain') AND NOT mva.is_procedural
        AND mva.member_choice <> mva.party_majority_choice
      GROUP BY vt.descriptor_edid
    )
    SELECT d.edid,
           d.text_et AS "nameEt", d.text_en AS "nameEn",
           f.text_et AS "fieldEt", f.text_en AS "fieldEn",
           c.votes::int AS votes,
           COALESCE(df.defections, 0)::int AS defections
    FROM counts c
    JOIN eurovoc_descriptors d ON d.edid = c.descriptor_edid
    LEFT JOIN eurovoc_microthesauri mt ON mt.etid = d.microthesaurus_etid
    LEFT JOIN eurovoc_fields f ON f.efid = mt.field_efid
    LEFT JOIN defs df ON df.descriptor_edid = c.descriptor_edid
    ORDER BY c.votes DESC, d.text_et ASC
  `);
  return rows as TopicIndexRow[];
}

export type TopicDetail = {
  edid: number;
  nameEt: string;
  nameEn: string | null;
  microEt: string | null;
  microEn: string | null;
  fieldEt: string | null;
  fieldEn: string | null;
  votes: number;
  bills: number;
  defections: number;
  members: TopicMemberRow[];
};

export type TopicBillRow = {
  draftUuid: string;
  draftTitle: string | null;
  draftMark: string | null;
  firstDate: string;
  lastDate: string;
  votes: number;
  defections: number;
};

/** Header (label + breadcrumb + totals) and per-member aggregation for one descriptor. */
export async function getTopicDetail(edid: number): Promise<TopicDetail | null> {
  const headerRes = await pool.query(
    `SELECT d.text_et AS "nameEt", d.text_en AS "nameEn",
            mt.text_et AS "microEt", mt.text_en AS "microEn",
            f.text_et AS "fieldEt", f.text_en AS "fieldEn"
       FROM eurovoc_descriptors d
       LEFT JOIN eurovoc_microthesauri mt ON mt.etid = d.microthesaurus_etid
       LEFT JOIN eurovoc_fields f ON f.efid = mt.field_efid
      WHERE d.edid = $1`,
    [edid],
  );
  if (headerRes.rows.length === 0) return null;
  const h = headerRes.rows[0];

  const totalsRes = await pool.query(
    `WITH topic_votes AS (
       SELECT DISTINCT mva.vote_id, mva.is_procedural, v.draft_uuid
       FROM member_vote_alignment mva
       JOIN vote_topics vt ON vt.vote_id = mva.vote_id
       JOIN votes v ON v.id = mva.vote_id
       WHERE vt.descriptor_edid = $1
     )
     SELECT COUNT(*) FILTER (WHERE NOT is_procedural)::int AS votes,
            COUNT(DISTINCT draft_uuid)::int AS bills
       FROM topic_votes`,
    [edid],
  );
  const totals = totalsRes.rows[0] ?? { votes: 0, bills: 0 };

  const membersRes = await pool.query(
    `SELECT m.id AS "memberId", m.full_name AS "fullName", m.slug,
            mcp.party_short_name AS "partyShortName",
            COALESCE(mcp.in_faction, false) AS "inFaction",
            COUNT(*) FILTER (WHERE mva.party_majority_choice IS NOT NULL
              AND mva.member_choice IN ('yes','no','abstain') AND NOT mva.is_procedural)::int AS counted,
            COUNT(*) FILTER (WHERE mva.party_majority_choice IS NOT NULL
              AND mva.member_choice IN ('yes','no','abstain') AND NOT mva.is_procedural
              AND mva.member_choice = mva.party_majority_choice)::int AS aligned,
            COUNT(*) FILTER (WHERE mva.party_majority_choice IS NOT NULL
              AND mva.member_choice IN ('yes','no','abstain') AND NOT mva.is_procedural
              AND mva.member_choice <> mva.party_majority_choice)::int AS defections
       FROM member_vote_alignment mva
       JOIN vote_topics vt ON vt.vote_id = mva.vote_id
       JOIN members m ON m.id = mva.member_id
       LEFT JOIN member_current_party mcp ON mcp.member_id = m.id
      WHERE vt.descriptor_edid = $1
      GROUP BY m.id, m.full_name, m.slug, mcp.party_short_name, mcp.in_faction`,
    [edid],
  );
  const members = membersRes.rows as TopicMemberRow[];

  return {
    edid,
    nameEt: h.nameEt,
    nameEn: h.nameEn,
    microEt: h.microEt,
    microEn: h.microEn,
    fieldEt: h.fieldEt,
    fieldEn: h.fieldEn,
    votes: Number(totals.votes),
    bills: Number(totals.bills),
    defections: members.reduce((s, r) => s + r.defections, 0),
    members,
  };
}

/** The bills carrying a descriptor, with per-bill vote/defection summaries. */
export async function getTopicBills(edid: number): Promise<TopicBillRow[]> {
  const { rows } = await pool.query(
    `SELECT v.draft_uuid AS "draftUuid",
            MAX(v.draft_title) AS "draftTitle",
            MAX(v.draft_mark) AS "draftMark",
            MIN(v.voted_at)::text AS "firstDate",
            MAX(v.voted_at)::text AS "lastDate",
            COUNT(DISTINCT v.id)::int AS votes,
            COUNT(*) FILTER (WHERE mva.party_majority_choice IS NOT NULL
              AND mva.member_choice IN ('yes','no','abstain') AND NOT mva.is_procedural
              AND mva.member_choice <> mva.party_majority_choice)::int AS defections
       FROM vote_topics vt
       JOIN votes v ON v.id = vt.vote_id
       JOIN member_vote_alignment mva ON mva.vote_id = vt.vote_id
      WHERE vt.descriptor_edid = $1
      GROUP BY v.draft_uuid
      ORDER BY MAX(v.voted_at) DESC`,
    [edid],
  );
  return rows as TopicBillRow[];
}
