import { getMemberDiscipline } from "./queries";
import { getSpeechLeaderboard } from "./speeches-queries";
import { getAbsenceLeaderboard, getMembersWithAge, getChildren } from "./varia-queries";
import { getCloseVotes } from "./decisive-queries";

// Front-page "stats hub": the single most-extreme member/vote per metric, each the top row of a
// leaderboard that already exists elsewhere. No new scoring -- just surfacing #1 and linking to
// the full page. Every field degrades to null (that card is then hidden). When several members
// share the top value (e.g. two MPs with the most children), `tied` > 1 and the card shows the
// count instead of crowning one arbitrarily.

// Full pages each card links to.
const HREF = {
  discipline: "/parteidistsipliin",
  speeches: "/statistika",
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
  tied: number; // how many members share this top value (1 = sole holder)
  href: string;
};
export type VoteHighlight = { name: string; value: number; href: string };

export type StatHighlights = {
  rebel: PersonHighlight | null; // most votes against own faction (lowest discipline)
  talker: PersonHighlight | null; // most words spoken
  absentee: PersonHighlight | null; // highest absence %
  closestVote: VoteHighlight | null; // smallest flip gap
  youngest: PersonHighlight | null; // youngest sitting member
  mostChildren: PersonHighlight | null; // most children
};

/** Count rows sharing `leader`'s exact ranking value -- a genuine tie, not a rounded-display one. */
function tieCount<T>(rows: T[], leader: T, key: (r: T) => number): number {
  const v = key(leader);
  return rows.filter((r) => key(r) === v).length;
}

async function rebel(): Promise<PersonHighlight | null> {
  try {
    // Rows are already sorted by discipline score ASC, so the first qualifying one is the lowest.
    const eligible = (await getMemberDiscipline()).filter(
      (x) => x.active && x.countedVotes >= MIN_VOTES && x.disciplineScore != null,
    );
    const r = eligible[0];
    if (!r) return null;
    // Show the against-rate (1 - alignment) -- that's what "against their faction" means.
    return {
      name: r.fullName,
      party: r.partyShortName,
      photoThumbPath: r.photoThumbPath,
      value: Math.round((1 - (r.disciplineScore as number)) * 100),
      tied: tieCount(eligible, r, (x) => x.disciplineScore as number),
      href: HREF.discipline,
    };
  } catch {
    return null;
  }
}

async function talker(): Promise<PersonHighlight | null> {
  try {
    const ranked = (await getSpeechLeaderboard())
      .filter((x) => x.active && x.totalWords > 0)
      .sort((a, b) => b.totalWords - a.totalWords);
    const r = ranked[0];
    if (!r) return null;
    return {
      name: r.fullName,
      party: r.partyShortName,
      photoThumbPath: r.photoThumbPath,
      value: r.totalWords,
      tied: tieCount(ranked, r, (x) => x.totalWords),
      href: HREF.speeches,
    };
  } catch {
    return null;
  }
}

async function absentee(): Promise<PersonHighlight | null> {
  try {
    const active = (await getAbsenceLeaderboard()).filter((x) => x.active); // sorted absentPct DESC
    const r = active[0];
    if (!r) return null;
    return {
      name: r.fullName,
      party: r.partyShortName,
      photoThumbPath: r.photoThumbPath,
      value: Math.round(r.absentPct),
      tied: tieCount(active, r, (x) => x.absentPct),
      href: HREF.absence,
    };
  } catch {
    return null;
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

async function youngest(): Promise<PersonHighlight | null> {
  try {
    // Sorted date_of_birth ASC -> youngest last. Ranked by exact date, so it's a sole holder.
    const r = (await getMembersWithAge()).at(-1);
    return r
      ? { name: r.fullName, party: r.partyShortName, photoThumbPath: r.photoThumbPath, value: r.age, tied: 1, href: HREF.generations }
      : null;
  } catch {
    return null;
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

/** All highlights in parallel; any that fail come back null (their card is hidden). */
export async function getStatHighlights(): Promise<StatHighlights> {
  const [r, t, a, c, y, k] = await Promise.all([
    rebel(), talker(), absentee(), closestVote(), youngest(), mostChildren(),
  ]);
  return { rebel: r, talker: t, absentee: a, closestVote: c, youngest: y, mostChildren: k };
}
