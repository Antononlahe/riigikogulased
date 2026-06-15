import { describe, it, expect } from "vitest";
import { partyToken, isKnownParty } from "./party";

describe("partyToken", () => {
  it("maps each known party to its fill + ink CSS vars and label", () => {
    expect(partyToken("RE")).toEqual({
      fill: "var(--party-re-fill)",
      ink: "var(--party-re-ink)",
      label: "RE",
    });
    expect(partyToken("EKRE").ink).toBe("var(--party-ekre-ink)");
    expect(partyToken("E200").fill).toBe("var(--party-e200-fill)");
    expect(partyToken("I").label).toBe("I");
  });

  it("falls back to a neutral token for null/unknown party", () => {
    const neutral = { fill: "var(--muted-foreground)", ink: "var(--muted-foreground)", label: "—" };
    expect(partyToken(null)).toEqual(neutral);
    expect(partyToken(undefined)).toEqual(neutral);
    expect(partyToken("XYZ")).toEqual(neutral);
  });
});

describe("isKnownParty", () => {
  it("is true only for the six seeded abbreviations", () => {
    expect(isKnownParty("KE")).toBe(true);
    expect(isKnownParty("SDE")).toBe(true);
    expect(isKnownParty(null)).toBe(false);
    expect(isKnownParty("nonsense")).toBe(false);
  });
});
