export type PartyShort = "RE" | "EKRE" | "KE" | "E200" | "SDE" | "I";

export type PartyToken = {
  /** CSS var for the saturated fill (discipline bar, avatar, accent, filled pill bg). */
  fill: string;
  /** CSS var for the readable ink (text/border, avatar initials). */
  ink: string;
  /** CSS var for text placed ON the fill (filled pill/chip). */
  onFill: string;
  /** Display label. */
  label: string;
};

const TABLE: Record<PartyShort, PartyToken> = {
  RE: { fill: "var(--party-re-fill)", ink: "var(--party-re-ink)", onFill: "var(--party-re-onfill)", label: "RE" },
  EKRE: { fill: "var(--party-ekre-fill)", ink: "var(--party-ekre-ink)", onFill: "var(--party-ekre-onfill)", label: "EKRE" },
  KE: { fill: "var(--party-ke-fill)", ink: "var(--party-ke-ink)", onFill: "var(--party-ke-onfill)", label: "KE" },
  E200: { fill: "var(--party-e200-fill)", ink: "var(--party-e200-ink)", onFill: "var(--party-e200-onfill)", label: "E200" },
  SDE: { fill: "var(--party-sde-fill)", ink: "var(--party-sde-ink)", onFill: "var(--party-sde-onfill)", label: "SDE" },
  I: { fill: "var(--party-i-fill)", ink: "var(--party-i-ink)", onFill: "var(--party-i-onfill)", label: "I" },
};

const NEUTRAL: PartyToken = {
  fill: "var(--muted-foreground)",
  ink: "var(--muted-foreground)",
  onFill: "var(--background)",
  label: "—",
};

export function isKnownParty(shortName: string | null | undefined): shortName is PartyShort {
  return !!shortName && shortName in TABLE;
}

export function partyToken(shortName: string | null | undefined): PartyToken {
  return isKnownParty(shortName) ? TABLE[shortName] : NEUTRAL;
}

/** The six seeded parties, in palette order, for filter controls. */
export const PARTY_ORDER: PartyShort[] = ["RE", "EKRE", "KE", "E200", "SDE", "I"];
