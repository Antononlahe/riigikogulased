import { getMemberDiscipline } from "./queries";
import { getSpeechLeaderboard } from "./speeches-queries";
import { getAbsenceLeaderboard, getMembersWithAge, getChildren } from "./varia-queries";
import { getCloseVotes } from "./decisive-queries";

// Front-page "stats hub": for each metric the most-extreme member at BOTH ends (most/least),
// each the top row of a leaderboard that already exists elsewhere. No new scoring -- just
// surfacing the extremes and linking to the full page. Every field degrades to null (that card
// is then hidden). When several members share the extreme value, `tied` > 1 and the card shows
// the count instead of crowning one arbitrarily.

// Full pages each card links to.
const HREF = {
  discipline: "/saadikud",
  speeches: "/statistika/sonavotud",
  absence: "/statistika/varia/kohalolek",
  decisive: "/statistika/otsustavad",
  generations: "/statistika/varia/polvkonnad",
  people: "/statistika/varia/inimesed",
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
  href: string;
  // Metric-specific context pair for the card's one-line "so what": [defections, counted] for
  // discipline, [absent, total] for absence, [total contributions] for speeches.
  detail?: number[];
};
export type VoteHighlight = { name: string; value: number; href: string };
// A metric's two ends: `top` = the superlative the card is named after, `bottom` = its opposite.
export type HighlightPair = { top: PersonHighlight | null; bottom: PersonHighlight | null };

export type StatHighlights = {
  rebel: HighlightPair; // most/least votes against own faction
  talker: HighlightPair; // most/fewest words spoken
  absentee: HighlightPair; // highest/lowest absence %
  closestVote: VoteHighlight | null; // smallest flip gap
  age: HighlightPair; // youngest (top) / oldest (bottom) sitting member
  mostChildren: PersonHighlight | null; // most children (a "least" is meaningless here)
};

/** Count rows sharing `leader`'s exact ranking value -- a genuine tie, not a rounded-display one. */
function tieCount<T>(rows: T[], leader: T, key: (r: T) => number): number {
  const v = key(leader);
  return rows.filter((r) => key(r) === v).length;
}

const EMPTY: HighlightPair = { top: null, bottom: null };

async function rebel(): Promise<HighlightPair> {
  try {
    // Rows are already sorted by discipline score ASC: first = biggest rebel, last = most loyal.
    const eligible = (await getMemberDiscipline()).filter(
      (x) => x.active && x.countedVotes >= MIN_VOTES && x.disciplineScore != null,
    );
    const pick = (r: (typeof eligible)[number] | undefined): PersonHighlight | null =>
      r
        ? {
            name: r.fullName,
            party: r.partyShortName,
            photoThumbPath: r.photoThumbPath,
            // Show the against-rate (1 - alignment) -- that's what "against their faction" means.
            value: Math.round((1 - (r.disciplineScore as number)) * 100),
            tied: tieCount(eligible, r, (x) => x.disciplineScore as number),
            href: HREF.discipline,
            detail: [r.defections, r.countedVotes],
          }
        : null;
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
    const pick = (r: (typeof ranked)[number] | undefined): PersonHighlight | null =>
      r
        ? {
            name: r.fullName,
            party: r.partyShortName,
            photoThumbPath: r.photoThumbPath,
            value: r.totalWords,
            tied: tieCount(ranked, r, (x) => x.totalWords),
            href: HREF.speeches,
            detail: [r.total],
          }
        : null;
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
    const pick = (r: (typeof active)[number] | undefined): PersonHighlight | null =>
      r
        ? {
            name: r.fullName,
            party: r.partyShortName,
            photoThumbPath: r.photoThumbPath,
            value: Math.round(r.absentPct),
            tied: tieCount(active, r, (x) => x.absentPct),
            href: HREF.absence,
            detail: [r.absent, r.total],
          }
        : null;
    return { top: pick(active[0]), bottom: pick(active.at(-1)) };
  } catch {
    return EMPTY;
  }
}

async function closestVote(): Promise<VoteHighlight | null> {
  try {
    const v = (await getCloseVotes(1))[0]; // ordered tightest-first
    return v ? { name: v.subject ?? v.title, value: v.flipGap, href: HREF.decisive } : null;
  } catch {
    return null;
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
            href: HREF.generations,
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
    return {
      name: r.fullName,
      party: r.partyShortName,
      photoThumbPath: null,
      value: r.children,
      tied: tieCount(rows, r, (x) => x.children),
      href: HREF.people,
    };
  } catch {
    return null;
  }
}

/** All highlights in parallel; any that fail come back null/empty (that card or row is hidden). */
export async function getStatHighlights(): Promise<StatHighlights> {
  const [r, t, a, c, y, k] = await Promise.all([
    rebel(), talker(), absentee(), closestVote(), age(), mostChildren(),
  ]);
  return { rebel: r, talker: t, absentee: a, closestVote: c, age: y, mostChildren: k };
}
