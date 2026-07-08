// Stenogram speech search: shared types between the route handler and the client search box.
// Highlight markers are unique sentinels (not HTML) so the client can render matches in
// <mark> via React text nodes — never dangerouslySetInnerHTML.

export const HL_START = "[[hl]]";
export const HL_END = "[[/hl]]";

// Estonian consonant gradation: the last plosive alternates between strong and weak grade
// (liit→liidu, pank→panga, sepp→sepa, heide→heite), so a plain prefix ("euroliit:*") never
// reaches the other grade ("euroliidu"). Swap the plosive when it follows a vowel/l/n/r and
// only vowels trail it, and emit the stem up to the swap as an extra prefix. A bogus variant
// is harmless: it can only over-highlight inside speeches that already matched.
const GRADE_SWAP: Record<string, string> = {
  tt: "t", kk: "k", pp: "p",
  t: "d", k: "g", p: "b",
  d: "t", g: "k", b: "p",
};

function gradeVariant(t: string): string | null {
  const m = t.match(/^(.*[aeiouõäöüšžlnr])(tt|kk|pp|[tkpbdg])[aeiouõäöü]*$/);
  return m ? m[1] + GRADE_SWAP[m[2]] : null;
}

// Build a prefix tsquery ("kool:* | õpe:*") for ts_headline so it highlights Estonian
// inflections/compounds (koolis, kooli, koolitus), not just the exact base form. The corpus
// `search` vector is lemma-indexed so it MATCHES those forms, but a plain headline query would
// miss them and fall back to the speech opening. Gradating stems get both grades as prefixes.
// Empty string if no usable token.
export function prefixHighlightQuery(q: string): string {
  const terms = q.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [];
  return terms
    .flatMap((t) => {
      const v = t.length >= 4 ? gradeVariant(t) : null;
      return v ? [t, v] : [t];
    })
    .map((t) => `${t}:*`)
    .join(" | ");
}

/** Compressed pager: first, last, and a window around the current page, with "…" gaps. */
export function pageList(current: number, last: number): (number | "…")[] {
  const wanted = new Set([1, last, current - 1, current, current + 1]);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (let p = 1; p <= last; p++) {
    if (!wanted.has(p)) continue;
    if (p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

export type SpeechHit = {
  speechKey: string;
  spokenAt: string | null;
  sittingDate: string | null;
  sittingType: string | null;
  agendaTitle: string | null;
  link: string | null;
  fullName: string;
  slug: string;
  partyShortName: string | null;
  /** Snippet with matches wrapped in HL_START/HL_END sentinels. */
  snippet: string;
};
