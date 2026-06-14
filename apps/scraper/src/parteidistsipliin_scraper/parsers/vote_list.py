from __future__ import annotations

import re
from datetime import datetime
from uuid import UUID

from selectolax.parser import HTMLParser

from parteidistsipliin_scraper.models import VoteListEntry

UUID_RE = re.compile(r"/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/?", re.I)

# A date inside a day heading, e.g.
#   "Taiskogu korraline istung kolmapaev, 11.06.2025 14:00"
HEADING_DATE_RE = re.compile(r"(\d{1,2})\.(\d{1,2})\.(\d{4})")

# ascii-folding for the Estonian letters that appear in vote titles.
_SLUG_FOLD = str.maketrans(
    {
        "õ": "o",
        "ä": "a",
        "ö": "o",
        "ü": "u",
        "š": "s",
        "ž": "z",
        "Õ": "o",
        "Ä": "a",
        "Ö": "o",
        "Ü": "u",
        "Š": "s",
        "Ž": "z",
    }
)


def title_to_slug(title: str) -> str:
    """Normalize a vote's listing title into a stable `vote_type_slug`.

    The Riigikogu detail URL always uses the literal slug `kohalolekukontroll`
    regardless of the vote, so the procedural category cannot be read off the URL.
    Instead we derive the slug from the visible title text. The two procedural
    titles seeded in `procedural_vote_types` must keep mapping to their seeded slugs:

        "Kohaloleku kontroll"   -> "kohalolekukontroll"
        "Paevakorra kinnitamine" -> "paevakorra-kinnitamine"

    Other titles get a generic slug: lowercase, ascii-folded Estonian letters, and
    every run of non-alphanumerics collapsed to a single hyphen.
    """
    normalized = title.strip().translate(_SLUG_FOLD).lower()
    # Special case: the presence check has no hyphen in its seeded slug.
    if normalized == "kohaloleku kontroll":
        return "kohalolekukontroll"
    slug = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    return slug


def parse_vote_list(html: str) -> list[VoteListEntry]:
    """Extract one VoteListEntry per row on a vote-listing page.

    Listing URL pattern:
      /tegevus/tooulevaade/haaletused/?startFrom=DD.MM.YYYY&endTo=DD.MM.YYYY&startDate=DD.MM.YYYY

    The page groups votes by sitting: a `<div class="group">` carries an `<h3>` day
    heading with the sitting date, followed by a `<table class="table table-striped
    full-bars marginT-5">` whose `<tbody>` rows are the individual votes. Each row's
    first `<td>` is the time (`HH:MM`); the "Haaletused" column holds the vote anchor
    `<a href=".../haaletustulemused-<slug>/<uuid>">Title</a>`.
    """
    tree = HTMLParser(html)
    entries: list[VoteListEntry] = []

    # The day heading and its table are siblings under the same container, so we
    # walk the document in order and remember the most recent heading date.
    current_date: tuple[int, int, int] | None = None

    body = tree.body or tree
    for node in body.traverse(include_text=False):
        if node.tag == "h3":
            m = HEADING_DATE_RE.search(node.text() or "")
            if m:
                day, month, year = (int(x) for x in m.groups())
                current_date = (year, month, day)
            continue
        if node.tag != "table":
            continue
        cls = node.attributes.get("class") or ""
        if "full-bars" not in cls:
            continue
        tbody = node.css_first("tbody") or node
        for row in tbody.css("tr"):
            link = row.css_first("a[href*='haaletustulemused']")
            if link is None:
                continue
            href = link.attributes.get("href") or ""
            um = UUID_RE.search(href)
            if not um:
                continue
            title = (link.text() or "").strip()

            time_cell = row.css_first("td")
            time_s = (time_cell.text() if time_cell else "").strip()
            voted_at = _row_datetime(current_date, time_s)

            entries.append(
                VoteListEntry(
                    riigikogu_uuid=UUID(um.group(1)),
                    voted_at=voted_at,
                    title=title,
                    detail_url=href,
                    vote_type_slug=title_to_slug(title) if title else None,
                )
            )

    return entries


def _row_datetime(day: tuple[int, int, int] | None, time_s: str) -> datetime:
    """Combine the sitting date (from the day heading) with the row time `HH:MM`."""
    year, month, dom = day or (1970, 1, 1)
    hour, minute = 0, 0
    tm = re.match(r"(\d{1,2}):(\d{2})", time_s)
    if tm:
        hour, minute = int(tm.group(1)), int(tm.group(2))
    return datetime(year, month, dom, hour, minute)
