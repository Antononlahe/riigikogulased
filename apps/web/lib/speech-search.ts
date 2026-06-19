// v0.5 stenogram speech search (REMOVABLE FEATURE). Shared types between the route handler
// and the client search box. Highlight markers are unique sentinels (not HTML) so the client
// can render matches in <mark> via React text nodes — never dangerouslySetInnerHTML.

export const HL_START = "[[hl]]";
export const HL_END = "[[/hl]]";

export type SpeechHit = {
  speechKey: string;
  spokenAt: string | null;
  sittingDate: string | null;
  agendaTitle: string | null;
  link: string | null;
  /** Snippet with matches wrapped in HL_START/HL_END sentinels. */
  snippet: string;
};
