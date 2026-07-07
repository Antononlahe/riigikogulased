import { describe, it, expect } from "vitest";
import { prefixHighlightQuery, pageList } from "./speech-search";

describe("pageList", () => {
  it("lists all pages when few", () => {
    expect(pageList(1, 1)).toEqual([1]);
    expect(pageList(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it("compresses middle gaps around the current page", () => {
    expect(pageList(7, 195)).toEqual([1, "…", 6, 7, 8, "…", 195]);
  });

  it("no gap markers at the edges", () => {
    expect(pageList(1, 10)).toEqual([1, 2, "…", 10]);
    expect(pageList(10, 10)).toEqual([1, "…", 9, 10]);
    expect(pageList(3, 10)).toEqual([1, 2, 3, 4, "…", 10]);
  });
});

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
