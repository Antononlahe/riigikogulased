from __future__ import annotations

import re
from datetime import datetime
from uuid import UUID

from selectolax.parser import HTMLParser

from parteidistsipliin_scraper.models import Ballot, Choice, VoteDetail

CHOICE_MAP: dict[str, Choice] = {
    "poolt": "yes",
    "vastu": "no",
    "erapooletu": "abstain",
    "ei hääletanud": "absent",
    "puudus": "absent",
    "neutraalne": "neutral",
}


def parse_vote_detail(
    html: str,
    *,
    riigikogu_uuid: UUID,
    vote_type_slug: str | None = None,
) -> VoteDetail:
    """Parse a single vote's detail page.

    `vote_type_slug` comes from the URL path (see `vote_list.VOTE_TYPE_SLUG_RE`) and
    is the source of truth for procedural classification; we don't try to derive it
    from the page body.

    # TODO: verify against live HTML. The structure usually has a header block with
    # tallies (poolt / vastu / erapooletu) and a list of MPs grouped by faction with
    # their individual choice. Selectors below are placeholders.
    """
    tree = HTMLParser(html)

    title_el = tree.css_first("h1, h2.title")
    title = (title_el.text() if title_el else "").strip()

    voted_at = _parse_meta_datetime(tree)
    agenda = _meta(tree, "Päevakorrapunkt") or _meta(tree, "Agenda")

    tallies = _parse_tallies(tree)
    ballots = _parse_ballots(tree)

    return VoteDetail(
        riigikogu_uuid=riigikogu_uuid,
        voted_at=voted_at,
        title=title,
        vote_type_slug=vote_type_slug,
        agenda_item=agenda,
        yes_count=tallies.get("yes", 0),
        no_count=tallies.get("no", 0),
        abstain_count=tallies.get("abstain", 0),
        absent_count=tallies.get("absent", 0),
        ballots=ballots,
    )


def _meta(tree: HTMLParser, label: str) -> str | None:
    for dt in tree.css("dt, th"):
        if (dt.text() or "").strip().rstrip(":").lower() == label.lower():
            sib = dt.next
            while sib is not None and sib.tag in ("#text",):
                sib = sib.next
            if sib is not None:
                return (sib.text() or "").strip() or None
    return None


def _parse_meta_datetime(tree: HTMLParser) -> datetime:
    raw = _meta(tree, "Aeg") or _meta(tree, "Kuupäev") or ""
    m = re.search(r"(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?", raw)
    if not m:
        return datetime(1970, 1, 1)
    d, mo, y, h, mi = m.groups()
    return datetime(int(y), int(mo), int(d), int(h or 0), int(mi or 0))


def _parse_tallies(tree: HTMLParser) -> dict[str, int]:
    out: dict[str, int] = {}
    for label_et, key in [
        ("Poolt", "yes"),
        ("Vastu", "no"),
        ("Erapooletu", "abstain"),
        ("Ei hääletanud", "absent"),
    ]:
        raw = _meta(tree, label_et)
        if raw and (m := re.search(r"\d+", raw)):
            out[key] = int(m.group(0))
    return out


def _parse_ballots(tree: HTMLParser) -> list[Ballot]:
    ballots: list[Ballot] = []
    for row in tree.css("table.haaled tr, ul.haaled li"):
        name_el = row.css_first(".nimi, a[href*='/riigikogu-liikmed/']")
        choice_el = row.css_first(".hääl, .choice, .vote")
        faction_el = row.css_first(".fraktsioon, .faction")
        if name_el is None or choice_el is None:
            continue
        choice_raw = (choice_el.text() or "").strip().lower()
        choice = CHOICE_MAP.get(choice_raw)
        if choice is None:
            continue
        href = (name_el.attributes.get("href") or "") if name_el.tag == "a" else ""
        rid = href.rstrip("/").rsplit("/", 1)[-1] if href else (name_el.text() or "").strip()
        ballots.append(
            Ballot(
                member_riigikogu_id=rid,
                member_full_name=(name_el.text() or "").strip(),
                party_short_name=(faction_el.text() if faction_el else None) or None,
                choice=choice,
            )
        )
    return ballots
