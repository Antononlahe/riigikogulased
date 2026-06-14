from __future__ import annotations

import re
from datetime import datetime
from uuid import UUID

from selectolax.parser import HTMLParser

from parteidistsipliin_scraper.models import VoteListEntry

UUID_RE = re.compile(r"/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/?", re.I)

# Detail URLs look like:
#   /tegevus/tooulevaade/haaletused/haaletustulemused-<slug>/<uuid>/
# capture <slug> so we can categorize procedural vs substantive votes.
VOTE_TYPE_SLUG_RE = re.compile(
    r"/haaletustulemused-([a-z0-9-]+)/[0-9a-f-]{36}/?",
    re.I,
)


def parse_vote_list(html: str) -> list[VoteListEntry]:
    """Extract one VoteListEntry per row on a vote-listing page.

    Listing URL pattern:
      /tegevus/tooulevaade/haaletused/?startDate=DD.MM.YYYY[&endDate=DD.MM.YYYY]

    # TODO: verify against live HTML. Riigikogu's listing markup uses a table; the
    # selectors below are best guesses from the URL shape. Update once a fixture is
    # captured.
    """
    tree = HTMLParser(html)
    entries: list[VoteListEntry] = []

    for row in tree.css("table.haaletused tr"):
        link = row.css_first("a[href*='haaletustulemused']")
        if link is None:
            continue
        href = link.attributes.get("href") or ""
        m = UUID_RE.search(href)
        if not m:
            continue
        title = (link.text() or "").strip()

        date_cell = row.css_first("td.kuupaev, td.date")
        time_cell = row.css_first("td.aeg, td.time")
        voted_at = _parse_et_datetime(
            (date_cell.text() if date_cell else "").strip(),
            (time_cell.text() if time_cell else "").strip(),
        )

        slug_match = VOTE_TYPE_SLUG_RE.search(href)
        entries.append(
            VoteListEntry(
                riigikogu_uuid=UUID(m.group(1)),
                voted_at=voted_at,
                title=title,
                detail_url=href,
                vote_type_slug=slug_match.group(1).lower() if slug_match else None,
            )
        )

    return entries


def _parse_et_datetime(date_s: str, time_s: str) -> datetime:
    """`DD.MM.YYYY` + `HH:MM` (Estonian format). Falls back to noon if no time."""
    day, month, year = [int(x) for x in date_s.split(".")]
    hour, minute = (0, 0)
    if time_s:
        parts = time_s.split(":")
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
    return datetime(year, month, day, hour, minute)
