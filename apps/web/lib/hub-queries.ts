import { pool } from "./db";
import { getMemberDiscipline } from "./queries";
import { getSpeechLeaderboard } from "./speeches-queries";
import { getAbsenceLeaderboard, getMembersWithAge, getChildren } from "./varia-queries";

// Front-page "stats hub": for each metric the most-extreme member at BOTH ends (most/least),
// each the top row of a leaderboard that already exists elsewhere. No new scoring -- just
// surfacing the extremes and linking to the full page. Every field degrades to null (that card
// is then hidden). When several members share the extreme value, `tied` > 1 and the card shows
// the count instead of crowning one arbitrarily.

// Full pages each card links to (also the cards' "see all" footer targets).
export const HREF = {
  discipline: "/saadikud",
  speeches: "/statistika/sonavotud",
  absence: "/statistika/varia/kohalolek",
  generations: "/statistika/varia/polvkonnad",
  // Deep anchors: the metric lives in one section of a longer page.
  children: "/statistika/varia/inimesed#lapsed",
  words: "/statistika/varia/margusonad#saadikud",
  caucuses: "/statistika/varia/parlamendiryhmad#enim-ryhmi",
} as const;

// A %-based superlative needs a floor, else a member with 2 votes and 1 defection "wins".
// 20 matches the absence leaderboard's own HAVING floor.
const MIN_VOTES = 20;

export type PersonHighlight = {
  name: string;
  party: string | null;
  photoThumbPath: string | null;
  value: number;
  tied: number; // how many members share this extreme value (1 = sole holder)
  // first two tied holders, with avatar bits so a two-way tie shows both faces (linked when tied === 2)
  tiedPeople: { name: string; slug: string; photoThumbPath: string | null; party: string | null }[];
  href: string;
  // Metric-specific context pair for the card's one-line "so what": [defections, counted] for
  // discipline, [absent, total] for absence, [total contributions] for speeches.
  detail?: number[];
};
// A metric's two ends: `top` = the superlative the card is named after, `bottom` = its opposite.
export type HighlightPair = { top: PersonHighlight | null; bottom: PersonHighlight | null };

export type WordHighlight = {
  name: string;
  party: string | null;
  photoThumbPath: string | null;
  word: string;
  href: string;
};

export type StatHighlights = {
  rebel: HighlightPair; // most/least votes against own faction
  talker: HighlightPair; // most/fewest words spoken
  absentee: HighlightPair; // highest/lowest absence %
  age: HighlightPair; // youngest (top) / oldest (bottom) sitting member
  mostChildren: PersonHighlight | null; // most children (a "least" is meaningless here)
  mandate: HighlightPair; // most/fewest personal votes behind a seat (value = votes)
  veteran: HighlightPair; // longest/shortest parliamentary seniority (value = days)
  signatureWord: WordHighlight | null; // the most distinctive member word in the corpus
  joiner: PersonHighlight | null; // most parlamendirühmad/caucus memberships
};

/** Common fields every leaderboard row carries; enough to render a linked avatar. */
type TieRow = { fullName: string; slug: string; partyShortName: string | null; photoThumbPath: string | null };
const asPerson = (r: TieRow) => ({ name: r.fullName, slug: r.slug, photoThumbPath: r.photoThumbPath, party: r.partyShortName });

/** Rows sharing `leader`'s exact ranking value -- a genuine tie, not a rounded-display one.
 *  Returns the count and the first two holders (a tie of 2 shows both, each linked). */
function tie<T extends TieRow>(rows: T[], leader: T, key: (r: T) => number) {
  const v = key(leader);
  const peers = rows.filter((r) => key(r) === v);
  return { tied: peers.length, tiedPeople: peers.slice(0, 2).map(asPerson) };
}

const EMPTY: HighlightPair = { top: null, bottom: null };

// Row href: a sole holder is a person -> their member page; a tie shows "N saadikut" -> the
// leaderboard where the tie is visible.
function rowHref(tied: number, slug: string, fallback: string): string {
  return tied > 1 ? fallback : `/saadik/${slug}`;
}

async function rebel(): Promise<HighlightPair> {
  try {
    // Rows are already sorted by discipline score ASC: first = biggest rebel, last = most loyal.
    const eligible = (await getMemberDiscipline()).filter(
      (x) => x.active && x.countedVotes >= MIN_VOTES && x.disciplineScore != null,
    );
    const pick = (r: (typeof eligible)[number] | undefined): PersonHighlight | null => {
      if (!r) return null;
      const { tied, tiedPeople } = tie(eligible, r, (x) => x.disciplineScore as number);
      return {
        name: r.fullName,
        party: r.partyShortName,
        photoThumbPath: r.photoThumbPath,
        // Show the against-rate (1 - alignment) -- that's what "against their faction" means.
        value: Math.round((1 - (r.disciplineScore as number)) * 100),
        tied,
        tiedPeople,
        href: rowHref(tied, r.slug, HREF.discipline),
        detail: [r.defections, r.countedVotes],
      };
    };
    return { top: pick(eligible[0]), bottom: pick(eligible.at(-1)) };
  } catch {
    return EMPTY;
  }
}

async function talker(): Promise<HighlightPair> {
  try {
    const ranked = (await getSpeechLeaderboard())
      .filter((x) => x.active && x.totalWords > 0)
      .sort((a, b) => b.totalWords - a.totalWords);
    const pick = (r: (typeof ranked)[number] | undefined): PersonHighlight | null => {
      if (!r) return null;
      const { tied, tiedPeople } = tie(ranked, r, (x) => x.totalWords);
      return {
        name: r.fullName,
        party: r.partyShortName,
        photoThumbPath: r.photoThumbPath,
        value: r.totalWords,
        tied,
        tiedPeople,
        href: rowHref(tied, r.slug, HREF.speeches),
        detail: [r.total],
      };
    };
    // Presiding officers' (juhatus) counts read artificially low -- exclude them from "quietest".
    const quiet = [...ranked].reverse().find((r) => !r.boardRole);
    return { top: pick(ranked[0]), bottom: pick(quiet) };
  } catch {
    return EMPTY;
  }
}

async function absentee(): Promise<HighlightPair> {
  try {
    const active = (await getAbsenceLeaderboard()).filter((x) => x.active); // sorted absentPct DESC
    const pick = (r: (typeof active)[number] | undefined): PersonHighlight | null => {
      if (!r) return null;
      const { tied, tiedPeople } = tie(active, r, (x) => x.absentPct);
      return {
        name: r.fullName,
        party: r.partyShortName,
        photoThumbPath: r.photoThumbPath,
        value: Math.round(r.absentPct),
        tied,
        tiedPeople,
        href: rowHref(tied, r.slug, HREF.absence),
        detail: [r.absent, r.total],
      };
    };
    return { top: pick(active[0]), bottom: pick(active.at(-1)) };
  } catch {
    return EMPTY;
  }
}

async function age(): Promise<HighlightPair> {
  try {
    // Sorted date_of_birth ASC -> oldest first, youngest last. Ranked by exact date, sole holders.
    const rows = await getMembersWithAge();
    const pick = (r: (typeof rows)[number] | undefined): PersonHighlight | null =>
      r
        ? {
            name: r.fullName,
            party: r.partyShortName,
            photoThumbPath: r.photoThumbPath,
            value: r.age,
            tied: 1,
            tiedPeople: [asPerson(r)],
            href: `/saadik/${r.slug}`,
          }
        : null;
    return { top: pick(rows.at(-1)), bottom: pick(rows[0]) };
  } catch {
    return EMPTY;
  }
}

async function mostChildren(): Promise<PersonHighlight | null> {
  try {
    const rows = await getChildren(); // sorted children DESC
    const r = rows[0];
    if (!r || r.children <= 0) return null;
    const { tied, tiedPeople } = tie(rows, r, (x) => x.children);
    return {
      name: r.fullName,
      party: r.partyShortName,
      photoThumbPath: r.photoThumbPath,
      value: r.children,
      tied,
      tiedPeople,
      href: rowHref(tied, r.slug, HREF.children),
    };
  } catch {
    return null;
  }
}

// Shared row shape for the plain-SQL highlights below.
type HubRow = {
  fullName: string;
  slug: string;
  partyShortName: string | null;
  photoThumbPath: string | null;
  value: number;
};

const HUB_ROW_COLS = `m.full_name AS "fullName", m.slug,
  mcp.party_short_name AS "partyShortName", m.photo_thumb_path AS "photoThumbPath"`;

function pickRow(
  rows: HubRow[],
  r: HubRow | undefined,
  fallbackHref = "/saadikud",
): PersonHighlight | null {
  if (!r) return null;
  const { tied, tiedPeople } = tie(rows, r, (x) => x.value);
  return {
    name: r.fullName,
    party: r.partyShortName,
    photoThumbPath: r.photoThumbPath,
    value: r.value,
    tied,
    tiedPeople,
    href: rowHref(tied, r.slug, fallbackHref),
  };
}

/** Personal votes behind the seat: vote magnet (top) vs cheapest mandate (bottom). */
async function mandate(): Promise<HighlightPair> {
  try {
    const { rows } = await pool.query(`
      SELECT ${HUB_ROW_COLS}, r.personal_votes::int AS value
      FROM member_election_results r
      JOIN members m ON m.id = r.member_id
      LEFT JOIN member_current_party mcp ON mcp.member_id = m.id
      WHERE m.active AND r.elected
      ORDER BY r.personal_votes DESC`);
    const all = rows as HubRow[];
    return { top: pickRow(all, all[0]), bottom: pickRow(all, all.at(-1)) };
  } catch {
    return EMPTY;
  }
}

/** Total parliamentary seniority in days (across all terms): veteran vs newcomer. */
async function veteran(): Promise<HighlightPair> {
  try {
    const { rows } = await pool.query(`
      SELECT ${HUB_ROW_COLS}, m.parliament_seniority_days AS value
      FROM members m
      LEFT JOIN member_current_party mcp ON mcp.member_id = m.id
      WHERE m.active AND m.parliament_seniority_days IS NOT NULL
      ORDER BY m.parliament_seniority_days DESC`);
    const all = rows as HubRow[];
    return { top: pickRow(all, all[0]), bottom: pickRow(all, all.at(-1)) };
  } catch {
    return EMPTY;
  }
}

/** The single most distinctive member signature word (TF-IDF rank 1, highest score).
 *  Links into the site-wide speech search pre-filled with the word. */
async function signatureWord(): Promise<WordHighlight | null> {
  try {
    const { rows } = await pool.query(`
      SELECT ${HUB_ROW_COLS}, st.lemma
      FROM signature_terms st
      JOIN members m ON m.id = st.scope_id
      LEFT JOIN member_current_party mcp ON mcp.member_id = m.id
      WHERE st.scope_kind = 'member' AND st.rank = 1 AND m.active
      ORDER BY st.score DESC
      LIMIT 1`);
    const r = rows[0] as (HubRow & { lemma: string }) | undefined;
    if (!r) return null;
    return {
      name: r.fullName,
      party: r.partyShortName,
      photoThumbPath: r.photoThumbPath,
      word: r.lemma,
      href: `/statistika/sonavotud?q=${encodeURIComponent(r.lemma)}`,
    };
  } catch {
    return null;
  }
}

/** Most parlamendirühmad + caucus memberships. */
async function joiner(): Promise<PersonHighlight | null> {
  try {
    const { rows } = await pool.query(`
      SELECT ${HUB_ROW_COLS}, count(*)::int AS value
      FROM member_caucuses mc
      JOIN members m ON m.id = mc.member_id
      LEFT JOIN member_current_party mcp ON mcp.member_id = m.id
      GROUP BY m.id, m.full_name, m.slug, mcp.party_short_name, m.photo_thumb_path
      ORDER BY value DESC, m.full_name`);
    const all = rows as HubRow[];
    // Member pages don't show caucus memberships, so even a sole holder links to the
    // "Enim rühmi" section of the parlamendirühmad page, not their profile.
    const p = pickRow(all, all[0], HREF.caucuses);
    return p && { ...p, href: HREF.caucuses };
  } catch {
    return null;
  }
}

/** All highlights in parallel; any that fail come back null/empty (that card or row is hidden). */
export async function getStatHighlights(): Promise<StatHighlights> {
  const [r, t, a, y, k, md, vt, sw, jn] = await Promise.all([
    rebel(), talker(), absentee(), age(), mostChildren(),
    mandate(), veteran(), signatureWord(), joiner(),
  ]);
  return {
    rebel: r, talker: t, absentee: a, age: y, mostChildren: k,
    mandate: md, veteran: vt, signatureWord: sw, joiner: jn,
  };
}
