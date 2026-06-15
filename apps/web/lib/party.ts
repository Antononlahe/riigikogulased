export type PartyShort = "RE" | "EKRE" | "KE" | "E200" | "SDE" | "I";

export type PartyToken = {
  /** CSS var for the saturated fill (discipline bar, avatar, dark badge). */
  fill: string;
  /** CSS var for the readable ink (outlined pill text + border). */
  ink: string;
  /** Display label. */
  label: string;
};

const TABLE: Record<PartyShort, PartyToken> = {
  RE: { fill: "var(--party-re-fill)", ink: "var(--party-re-ink)", label: "RE" },
  EKRE: { fill: "var(--party-ekre-fill)", ink: "var(--party-ekre-ink)", label: "EKRE" },
  KE: { fill: "var(--party-ke-fill)", ink: "var(--party-ke-ink)", label: "KE" },
  E200: { fill: "var(--party-e200-fill)", ink: "var(--party-e200-ink)", label: "E200" },
  SDE: { fill: "var(--party-sde-fill)", ink: "var(--party-sde-ink)", label: "SDE" },
  I: { fill: "var(--party-i-fill)", ink: "var(--party-i-ink)", label: "I" },
};

const NEUTRAL: PartyToken = {
  fill: "var(--muted-foreground)",
  ink: "var(--muted-foreground)",
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
