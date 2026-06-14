from __future__ import annotations

import re
from datetime import datetime
from uuid import UUID

from selectolax.parser import HTMLParser

from parteidistsipliin_scraper.models import Ballot, Choice, VoteDetail, normalize_faction

# Maps the visible Estonian decision label to the internal `ballots.choice` domain.
# Riigikogu distinguishes "Ei haaletanud" (present but did not register a vote) from
# "Puudub" (absent from the chamber); per CLAUDE.md these must not be collapsed:
#   Ei haaletanud -> neutral, Puudub -> absent.
CHOICE_MAP: dict[str, Choice] = {
    "poolt": "yes",
    "vastu": "no",
    "erapooletu": "abstain",
    "ei haaletanud": "neutral",
    "puudub": "absent",
}

SAADIK_UUID_RE = re.compile(
    r"/saadik/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/",
    re.I,
)

# ascii-fold for keying the decision label (avoids depending on a/a etc.).
_FOLD = str.maketrans({"ä": "a", "õ": "o", "ö": "o", "ü": "u"})


def parse_vote_detail(
    html: str,
    *,
    riigikogu_uuid: UUID,
    vote_type_slug: str | None = None,
) -> VoteDetail:
    """Parse a single vote's detail page.

    The detail URL slug is always `kohalolekukontroll`, so `vote_type_slug` is not
    derived here. It is passed in from the listing, where it is derived from the
    vote title (see `vote_list.title_to_slug`).

    The page renders every member exactly once inside the "Koik" tab (``#koik``)
    as a `table.table-striped.full-bars`: one `<tr>` per member with a name link
    (`/saadik/<uuid>/<Name>`), a decision (`span.bar-title`), and a faction link.
    The per-choice tabs (#poolt, #vastu, ...) duplicate these rows, so we read only
    the "Koik" table to avoid double counting.
    """
    tree = HTMLParser(html)

    title_el = tree.css_first("h1.title, h1, h2.title")
    title = (title_el.text() if title_el else "").strip()

    voted_at = _parse_title_datetime(title)
    tallies = _parse_tallies(tree)
    ballots = _parse_ballots(tree)

    return VoteDetail(
        riigikogu_uuid=riigikogu_uuid,
        voted_at=voted_at,
        title=title,
        vote_type_slug=vote_type_slug,
        agenda_item=None,
        yes_count=tallies.get("yes", 0),
        no_count=tallies.get("no", 0),
        abstain_count=tallies.get("abstain", 0),
        absent_count=tallies.get("absent", 0),
        ballots=ballots,
    )


def _parse_title_datetime(title: str) -> datetime:
    """The detail H1 reads "Haaletustulemused DD.MM.YYYY / HH:MM"."""
    m = re.search(r"(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s*/\s*(\d{1,2}):(\d{2}))?", title)
    if not m:
        return datetime(1970, 1, 1)
    d, mo, y, h, mi = m.groups()
    return datetime(int(y), int(mo), int(d), int(h or 0), int(mi or 0))


def _parse_tallies(tree: HTMLParser) -> dict[str, int]:
    """Read the header tab counts: "Poolt - 16", "Vastu - 40", "Erapooletu - 0"."""
    out: dict[str, int] = {}
    label_to_key = {
        "poolt": "yes",
        "vastu": "no",
        "erapooletu": "abstain",
        "puudub": "absent",
    }
    for tab in tree.css("div.tabs a"):
        text = " ".join((tab.text() or "").split())
        m = re.match(r"([A-Za-zõäöüÕÄÖÜ ]+?)\s*-\s*(\d+)", text)
        if not m:
            continue
        label = m.group(1).strip().lower().translate(_FOLD)
        key = label_to_key.get(label)
        if key is not None:
            out[key] = int(m.group(2))
    return out


def _parse_ballots(tree: HTMLParser) -> list[Ballot]:
    koik = tree.css_first("#koik")
    if koik is None:
        return []
    table = koik.css_first("table.full-bars") or koik.css_first("table")
    if table is None:
        return []

    ballots: list[Ballot] = []
    for row in table.css("tbody tr"):
        name_el = row.css_first("a[href*='/saadik/']")
        if name_el is None:
            continue
        href = name_el.attributes.get("href") or ""
        um = SAADIK_UUID_RE.search(href)
        if not um:
            continue

        choice_el = row.css_first("span.bar-title")
        choice_raw = (choice_el.text() if choice_el else "").strip().lower().translate(_FOLD)
        choice = CHOICE_MAP.get(choice_raw)
        if choice is None:
            continue

        faction_el = row.css_first("a[href*='/fraktsioonid/']")
        faction = normalize_faction(faction_el.text() if faction_el else None)

        ballots.append(
            Ballot(
                member_riigikogu_id=um.group(1),
                member_full_name=(name_el.text() or "").strip(),
                party_short_name=faction,
                choice=choice,
            )
        )
    return ballots
