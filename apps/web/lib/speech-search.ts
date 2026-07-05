// v0.5 stenogram speech search (REMOVABLE FEATURE). Shared types between the route handler
// and the client search box. Highlight markers are unique sentinels (not HTML) so the client
// can render matches in <mark> via React text nodes — never dangerouslySetInnerHTML.

export const HL_START = "[[hl]]";
export const HL_END = "[[/hl]]";

// Build a prefix tsquery ("kool:* | õpe:*") for ts_headline so it highlights Estonian
// inflections/compounds (koolis, kooli, koolitus), not just the exact base form. The corpus
// `search` vector is lemma-indexed so it MATCHES those forms, but a plain headline query would
// miss them and fall back to the speech opening. Empty string if no usable token.
export function prefixHighlightQuery(q: string): string {
  const terms = q.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [];
  return terms.map((t) => `${t}:*`).join(" | ");
}

export type SpeechHit = {
  speechKey: string;
  spokenAt: string | null;
  sittingDate: string | null;
  sittingType: string | null;
  agendaTitle: string | null;
  link: string | null;
  /** Snippet with matches wrapped in HL_START/HL_END sentinels. */
  snippet: string;
};
