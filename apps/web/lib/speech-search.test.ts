import { describe, it, expect } from "vitest";
import { prefixHighlightQuery } from "./speech-search";

describe("prefixHighlightQuery", () => {
  it("makes each term a prefix, OR-joined", () => {
    expect(prefixHighlightQuery("kool")).toBe("kool:*");
    expect(prefixHighlightQuery("eesti kool")).toBe("eesti:* | kool:*");
  });

  it("lowercases and keeps Estonian letters", () => {
    expect(prefixHighlightQuery("Õppekava")).toBe("õppekava:*");
  });

  it("drops punctuation and 1-char tokens (would over-highlight)", () => {
    expect(prefixHighlightQuery("a, kool!")).toBe("kool:*");
    expect(prefixHighlightQuery("co2 heide")).toBe("co2:* | heide:*");
  });

  it("returns empty string when nothing usable", () => {
    expect(prefixHighlightQuery("!!")).toBe("");
    expect(prefixHighlightQuery("")).toBe("");
  });
});
