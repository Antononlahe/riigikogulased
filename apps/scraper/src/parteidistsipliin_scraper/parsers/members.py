from __future__ import annotations

from selectolax.parser import HTMLParser

from parteidistsipliin_scraper.models import MemberSummary


def parse_members(html: str) -> list[MemberSummary]:
    """Parse the Riigikogu members listing page.

    # TODO: verify against live HTML. Members are typically listed grouped by
    # faction, each with a link to their profile that contains the natural ID at
    # the end of the URL.
    """
    tree = HTMLParser(html)
    out: list[MemberSummary] = []
    for card in tree.css("article.liige, li.liige, tr.liige"):
        name_el = card.css_first("a[href*='/riigikogu-liikmed/']")
        if name_el is None:
            continue
        href = name_el.attributes.get("href") or ""
        rid = href.rstrip("/").rsplit("/", 1)[-1]
        party_el = card.css_first(".fraktsioon, .faction")
        out.append(
            MemberSummary(
                riigikogu_id=rid,
                full_name=(name_el.text() or "").strip(),
                party_short_name=(party_el.text() if party_el else None) or None,
            )
        )
    return out
