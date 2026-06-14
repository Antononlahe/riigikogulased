from __future__ import annotations

import re

from selectolax.parser import HTMLParser

from parteidistsipliin_scraper.models import MemberSummary, normalize_faction

SAADIK_UUID_RE = re.compile(
    r"/saadik/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/",
    re.I,
)


def parse_members(html: str) -> list[MemberSummary]:
    """Parse the Riigikogu members listing page.

    Members are rendered as `<ul class="profile-list">` items, one
    `<li class="item col-xs-6">` per MP. Inside each item the name link is
    `/riigikogu-liikmed/saadik/<uuid>/<Name-With-Dashes>` and the faction is a
    plain `<li><strong>Faction name</strong></li>`. The natural key is the `<uuid>`
    segment of the profile URL, not the trailing name slug.
    """
    tree = HTMLParser(html)
    out: list[MemberSummary] = []
    seen: set[str] = set()

    for card in tree.css("ul.profile-list li.item"):
        name_el = None
        for a in card.css("a[href*='/saadik/']"):
            href = a.attributes.get("href") or ""
            if SAADIK_UUID_RE.search(href) and (a.text() or "").strip():
                name_el = a
                break
        if name_el is None:
            continue
        href = name_el.attributes.get("href") or ""
        m = SAADIK_UUID_RE.search(href)
        if not m:
            continue
        rid = m.group(1)
        if rid in seen:
            continue
        seen.add(rid)

        faction_el = card.css_first("strong")
        faction = normalize_faction(faction_el.text() if faction_el else None)

        out.append(
            MemberSummary(
                riigikogu_id=rid,
                full_name=(name_el.text() or "").strip(),
                party_short_name=faction,
                party_name=faction,
            )
        )
    return out
