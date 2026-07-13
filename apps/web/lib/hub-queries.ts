import { getTranslations } from "next-intl/server";
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
  words: "/statistika/varia/marksonad#saadikud",
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
    if (!r || r.children == null || r.children <= 0) return null;
    const { tied, tiedPeople } = tie(rows, r, (x) => x.children ?? 0);
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

/** Personal votes behind the seat, elected members, most first. Shared by the v1 extreme
 *  picker and the v2 ranked rail. */
async function mandateRows(): Promise<HubRow[]> {
  const { rows } = await pool.query(`
    SELECT ${HUB_ROW_COLS}, r.personal_votes::int AS value
    FROM member_election_results r
    JOIN members m ON m.id = r.member_id
    LEFT JOIN member_current_party mcp ON mcp.member_id = m.id
    WHERE m.active AND r.elected
    ORDER BY r.personal_votes DESC`);
  return rows as HubRow[];
}

/** Personal votes behind the seat: vote magnet (top) vs cheapest mandate (bottom). */
async function mandate(): Promise<HighlightPair> {
  try {
    const all = await mandateRows();
    return { top: pickRow(all, all[0]), bottom: pickRow(all, all.at(-1)) };
  } catch {
    return EMPTY;
  }
}

/** Total parliamentary seniority in days (across all terms), longest first. Shared by v1 + v2. */
async function veteranRows(): Promise<HubRow[]> {
  const { rows } = await pool.query(`
    SELECT ${HUB_ROW_COLS}, m.parliament_seniority_days AS value
    FROM members m
    LEFT JOIN member_current_party mcp ON mcp.member_id = m.id
    WHERE m.active AND m.parliament_seniority_days IS NOT NULL
    ORDER BY m.parliament_seniority_days DESC`);
  return rows as HubRow[];
}

/** Total parliamentary seniority in days (across all terms): veteran vs newcomer. */
async function veteran(): Promise<HighlightPair> {
  try {
    const all = await veteranRows();
    return { top: pickRow(all, all[0]), bottom: pickRow(all, all.at(-1)) };
  } catch {
    return EMPTY;
  }
}

/** The single most distinctive member signature word (TF-IDF rank 1, highest score).
 *  Links into the site-wide speech search pre-filled with the word. */
async function signatureWordRow(): Promise<(HubRow & { lemma: string }) | undefined> {
  const { rows } = await pool.query(`
    SELECT ${HUB_ROW_COLS}, st.lemma
    FROM signature_terms st
    JOIN members m ON m.id = st.scope_id
    LEFT JOIN member_current_party mcp ON mcp.member_id = m.id
    WHERE st.scope_kind = 'member' AND st.rank = 1 AND m.active
    ORDER BY st.score DESC
    LIMIT 1`);
  return rows[0] as (HubRow & { lemma: string }) | undefined;
}

async function signatureWord(): Promise<WordHighlight | null> {
  try {
    const r = await signatureWordRow();
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

/** Members ranked by parlamendirühmad + caucus memberships, most first. Shared by v1 + v2. */
async function joinerRows(): Promise<HubRow[]> {
  const { rows } = await pool.query(`
    SELECT ${HUB_ROW_COLS}, count(*)::int AS value
    FROM member_caucuses mc
    JOIN members m ON m.id = mc.member_id
    LEFT JOIN member_current_party mcp ON mcp.member_id = m.id
    GROUP BY m.id, m.full_name, m.slug, mcp.party_short_name, m.photo_thumb_path
    ORDER BY value DESC, m.full_name`);
  return rows as HubRow[];
}

/** Most parlamendirühmad + caucus memberships. */
async function joiner(): Promise<PersonHighlight | null> {
  try {
    const all = await joinerRows();
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

// ---------------------------------------------------------------------------
// v2 "themed rails" front page. Same underlying leaderboards as getStatHighlights,
// but a short RANKED list per theme instead of just the two extremes. No new scoring.
// ponytail: refetches the same lists getStatHighlights already read (both run only at
// daily ISR build/revalidate) -- dedupe into one shared fetch only if that ever matters.
// ---------------------------------------------------------------------------

export type RailPerson = { name: string; slug: string; party: string | null; photoThumbPath: string | null };
export type RailCard =
  | { kind: "single"; eyebrow: string; person: RailPerson; value: string; sub?: string; href: string }
  | { kind: "tie2"; eyebrow: string; value: string; sub?: string; people: RailPerson[] }
  | { kind: "tieN"; eyebrow: string; value: string; sub?: string; sample: RailPerson[]; more: number; href: string }
  | { kind: "quote"; eyebrow: string; word: string; person: RailPerson; sub?: string; href: string };
export type HubRail = { key: string; title: string; kicker: string; info?: string; seeAll: string; moreHref: string; cards: RailCard[] };

const personOf = (r: TieRow): RailPerson => ({
  name: r.fullName, slug: r.slug, party: r.partyShortName, photoThumbPath: r.photoThumbPath,
});
const memberHref = (r: TieRow) => `/saadik/${r.slug}`;

/** All rails in parallel; any that throws is simply skipped (that whole rail is hidden). */
export async function getHubRails(): Promise<HubRail[]> {
  const t = await getTranslations("hub");
  const settled = await Promise.allSettled([
    disciplineRail(t), speechRail(t), absenceRail(t), ageRail(t),
    mandateRail(t), seniorityRail(t), variaRail(t),
  ]);
  return settled
    .map((s) => (s.status === "fulfilled" ? s.value : null))
    .filter((r): r is HubRail => r !== null && r.cards.length > 0);
}

type T = Awaited<ReturnType<typeof getTranslations>>;

async function disciplineRail(t: T): Promise<HubRail> {
  // Already sorted by discipline score ASC: biggest rebel first, most loyal last.
  const rows = (await getMemberDiscipline()).filter(
    (x) => x.active && x.countedVotes >= MIN_VOTES && x.disciplineScore != null,
  );
  const against = (s: number) => 1 - s;
  const cards: RailCard[] = rows.slice(0, 4).map((r, i) => ({
    kind: "single",
    eyebrow: i === 0 ? t("rail.against") : `${i + 1}.`,
    person: personOf(r),
    value: `${Math.round(against(r.disciplineScore as number) * 100)}%`,
    sub: t("rebelSub", { d: r.defections, c: r.countedVotes }),
    href: memberHref(r),
  }));
  // Loyal end: everyone sharing the highest score. Usually a big tie at 100% (never voted against).
  const maxScore = rows.length ? (rows.at(-1)!.disciplineScore as number) : 0;
  const loyal = rows.filter((x) => (x.disciplineScore as number) === maxScore);
  const perfect = maxScore >= 0.9999;
  const loyalValue = `${Math.round(against(maxScore) * 100)}%`;
  const loyalSub = perfect ? t("rail.loyalSub") : undefined;
  if (loyal.length >= 3) {
    cards.push({
      kind: "tieN", eyebrow: t("rail.loyal"), value: t("tiedCount", { n: loyal.length }),
      sub: loyalSub, sample: loyal.slice(0, 3).map(personOf), more: loyal.length - 3, href: HREF.discipline,
    });
  } else if (loyal.length === 2) {
    cards.push({ kind: "tie2", eyebrow: t("rail.loyal"), value: loyalValue, sub: loyalSub, people: loyal.map(personOf) });
  } else if (loyal.length === 1) {
    cards.push({ kind: "single", eyebrow: t("rail.loyal"), person: personOf(loyal[0]), value: loyalValue, sub: loyalSub, href: memberHref(loyal[0]) });
  }
  return { key: "discipline", title: t("rail.title.discipline"), kicker: t("rail.kicker.discipline"), seeAll: t("seeAll"), moreHref: HREF.discipline, cards };
}

async function speechRail(t: T): Promise<HubRail> {
  // Presiding officers (esimees/aseesimehed) chair sittings, so their word counts read
  // artificially low -- exclude the whole juhatus from both ends (explained by the rail's (i)).
  const rows = (await getSpeechLeaderboard())
    .filter((x) => x.active && x.totalWords > 0 && !x.boardRole)
    .sort((a, b) => b.totalWords - a.totalWords);
  const cards: RailCard[] = rows.slice(0, 4).map((r, i) => ({
    kind: "single",
    eyebrow: i === 0 ? t("rail.words") : `${i + 1}.`,
    person: personOf(r),
    value: t("talkerValue", { n: r.totalWords }),
    sub: t("talkerSub", { n: r.total }),
    href: memberHref(r),
  }));
  const quiet = rows.at(-1);
  if (quiet && quiet !== rows[0]) {
    cards.push({
      kind: "single", eyebrow: t("rail.quiet"), person: personOf(quiet),
      value: t("talkerValue", { n: quiet.totalWords }), sub: t("talkerSub", { n: quiet.total }),
      href: memberHref(quiet),
    });
  }
  return { key: "speeches", title: t("rail.title.speeches"), kicker: t("rail.kicker.speeches"), info: t("rail.speechesInfo"), seeAll: t("seeAll"), moreHref: HREF.speeches, cards };
}

async function absenceRail(t: T): Promise<HubRail> {
  const rows = (await getAbsenceLeaderboard()).filter((x) => x.active); // absentPct DESC
  const cards: RailCard[] = rows.slice(0, 3).map((r, i) => ({
    kind: "single",
    eyebrow: i === 0 ? t("rail.absent") : `${i + 1}.`,
    person: personOf(r),
    value: t("absenteeValue", { pct: Math.round(r.absentPct) }),
    sub: t("absenteeSub", { a: r.absent, c: r.total }),
    href: memberHref(r),
  }));
  const best = rows.at(-1);
  if (best && best !== rows[0]) {
    cards.push({
      kind: "single", eyebrow: t("rail.present"), person: personOf(best),
      value: t("absenteeValue", { pct: Math.round(best.absentPct) }),
      sub: t("absenteeSub", { a: best.absent, c: best.total }), href: memberHref(best),
    });
  }
  return { key: "absence", title: t("rail.title.absence"), kicker: t("rail.kicker.absence"), seeAll: t("seeAll"), moreHref: HREF.absence, cards };
}

async function ageRail(t: T): Promise<HubRail> {
  const rows = await getMembersWithAge(); // date_of_birth ASC -> oldest first, youngest last
  const cards: RailCard[] = [];
  const youngest = rows.at(-1), y2 = rows.at(-2), oldest = rows[0];
  if (youngest) cards.push({ kind: "single", eyebrow: t("rail.youngest"), person: personOf(youngest), value: t("youngestValue", { age: youngest.age }), href: memberHref(youngest) });
  if (y2) cards.push({ kind: "single", eyebrow: "2.", person: personOf(y2), value: t("youngestValue", { age: y2.age }), href: memberHref(y2) });
  if (oldest && oldest !== youngest) cards.push({ kind: "single", eyebrow: t("rail.oldest"), person: personOf(oldest), value: t("youngestValue", { age: oldest.age }), href: memberHref(oldest) });
  return { key: "age", title: t("rail.title.age"), kicker: t("rail.kicker.age"), seeAll: t("seeAll"), moreHref: HREF.generations, cards };
}

async function mandateRail(t: T): Promise<HubRail> {
  const rows = await mandateRows(); // personal_votes DESC
  const cards: RailCard[] = rows.slice(0, 3).map((r, i) => ({
    kind: "single",
    eyebrow: i === 0 ? t("rail.votes") : `${i + 1}.`,
    person: personOf(r),
    value: t("votesValue", { n: r.value }),
    href: memberHref(r),
  }));
  const cheap = rows.at(-1);
  if (cheap && cheap !== rows[0]) cards.push({ kind: "single", eyebrow: t("rail.fewVotes"), person: personOf(cheap), value: t("votesValue", { n: cheap.value }), href: memberHref(cheap) });
  return { key: "mandate", title: t("rail.title.mandate"), kicker: t("rail.kicker.mandate"), seeAll: t("seeAll"), moreHref: "/saadikud", cards };
}

async function seniorityRail(t: T): Promise<HubRail> {
  const rows = await veteranRows(); // seniority days DESC
  const years = (days: number) => Math.round(days / 365.25);
  const cards: RailCard[] = rows.slice(0, 2).map((r, i) => ({
    kind: "single",
    eyebrow: i === 0 ? t("rail.senior") : "2.",
    person: personOf(r),
    value: t("veteranValue", { n: years(r.value) }),
    href: memberHref(r),
  }));
  const newcomer = rows.at(-1);
  if (newcomer) {
    cards.push({
      kind: "single", eyebrow: t("rail.newcomer"), person: personOf(newcomer),
      // A fresh substitute reads better in days; anyone past a year, in years.
      value: newcomer.value < 365 ? t("newcomerValue", { n: newcomer.value }) : t("veteranValue", { n: years(newcomer.value) }),
      href: memberHref(newcomer),
    });
  }
  return { key: "seniority", title: t("rail.title.seniority"), kicker: t("rail.kicker.seniority"), seeAll: t("seeAll"), moreHref: "/saadikud", cards };
}

async function variaRail(t: T): Promise<HubRail> {
  const cards: RailCard[] = [];
  // Most children -- often a genuine tie at the top.
  const ch = await getChildren();
  const c0 = ch[0];
  if (c0 && c0.children != null && c0.children > 0) {
    const peers = ch.filter((x) => x.children === c0.children);
    const value = t("childrenValue", { n: c0.children });
    if (peers.length >= 3) cards.push({ kind: "tieN", eyebrow: t("rail.children"), value, sample: peers.slice(0, 3).map(personOf), more: peers.length - 3, href: HREF.children });
    else if (peers.length === 2) cards.push({ kind: "tie2", eyebrow: t("rail.children"), value, people: peers.map(personOf) });
    else cards.push({ kind: "single", eyebrow: t("rail.children"), person: personOf(c0), value, href: HREF.children });
  }
  // Signature word (a quote card, links into the speech search).
  const sw = await signatureWordRow();
  if (sw) cards.push({
    kind: "quote", eyebrow: t("rail.word"), word: t("sigValue", { word: sw.lemma }),
    person: { name: sw.fullName, slug: sw.slug, party: sw.partyShortName, photoThumbPath: sw.photoThumbPath },
    sub: t("sigSub"), href: `/statistika/sonavotud?q=${encodeURIComponent(sw.lemma)}`,
  });
  // Most caucus memberships.
  const jn = await joinerRows();
  const j0 = jn[0];
  if (j0) cards.push({ kind: "single", eyebrow: t("rail.caucuses"), person: personOf(j0), value: t("joinerValue", { n: j0.value }), href: HREF.caucuses });
  return { key: "varia", title: t("rail.title.varia"), kicker: t("rail.kicker.varia"), seeAll: t("seeAll"), moreHref: "/statistika/varia", cards };
}
