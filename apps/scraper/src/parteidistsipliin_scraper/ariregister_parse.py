from __future__ import annotations

import re
from datetime import date

from bs4 import BeautifulSoup, Tag

from parteidistsipliin_scraper.ariregister_models import Candidate, Membership

# ---------------------------------------------------------------------------
# Module-level regex constants (markup-independent)
# ---------------------------------------------------------------------------

_RE_DATE = re.compile(r"\b(\d{2})\.(\d{2})\.(\d{4})\b")
_RE_HISTORY_HREF = re.compile(r"member_history/(\d+)")
_RE_REGISTRY_CODE = re.compile(r"\b(\d{8})\b")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_date(text: str) -> date | None:
    """Return the first DD.MM.YYYY date found in *text*, or None."""
    m = _RE_DATE.search(text)
    if not m:
        return None
    day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return date(year, month, day)


def _card_field(card: Tag, label: str) -> str | None:
    """Find a field value inside a card div by its label text.

    Each field is rendered as:
        <div class="row flex-nowrap">
            <div class="col-... text-muted ...">Label text</div>
            <div class="col-... font-weight-bold">Value text</div>
        </div>
    """
    for row in card.find_all("div", class_="row"):
        muted = row.find("div", class_="text-muted")
        bold = row.find("div", class_="font-weight-bold")
        if muted and bold and label in muted.get_text():
            return bold.get_text(strip=True) or None
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def parse_search_results(html: str) -> list[Candidate]:
    """Parse an ariregister members_search result page and return one Candidate
    per result card.

    The page is card-based (not a table). Each result lives in a
    ``<div class="d-none mb-4" id="popover_N">`` element.  Within the card,
    fields are labeled ``text-muted`` divs paired with ``font-weight-bold``
    value divs.  The "Liikme ajalugu" anchor carries the numeric person_id in
    its href (``member_history/<id>``).
    """
    soup = BeautifulSoup(html, "html.parser")
    candidates: list[Candidate] = []

    # Each card is a div whose id starts with "popover_"
    for card in soup.find_all("div", id=re.compile(r"^popover_\d+")):
        if not isinstance(card, Tag):
            continue

        # Find the history anchor; skip cards without one
        history_anchor = card.find("a", href=_RE_HISTORY_HREF)
        if not isinstance(history_anchor, Tag):
            continue

        href = history_anchor.get("href", "")
        id_match = _RE_HISTORY_HREF.search(str(href))
        if not id_match:
            continue
        person_id = id_match.group(1)

        # Extract first name, last name
        first = _card_field(card, "Eesnimi")
        last = _card_field(card, "Perekonnanimi")
        if not first or not last:
            continue
        full_name = f"{first} {last}"

        # Date of birth: first date in the Isikukood / suenniaeg field value
        dob_text = _card_field(card, "Isikukood")
        date_of_birth = _parse_date(dob_text) if dob_text else None

        # Current party (may be absent for non-attached members)
        party_name = _card_field(card, "Erakond")

        candidates.append(
            Candidate(
                full_name=full_name,
                date_of_birth=date_of_birth,
                party_name=party_name,
                person_id=person_id,
            )
        )

    return candidates


def parse_member_history(html: str) -> list[Membership]:
    """Parse an ariregister member_history page and return one Membership per
    table row.

    The page contains a ``<table id="party_table">`` whose data rows have the
    following ``<td>`` layout (0-indexed):
        0 – empty (icon/checkbox)
        1 – party name (Nimetus)
        2 – 8-digit registry code (Registrikood)
        3 – status text (e.g. "Registrisse kantud", "Kustutatud")
        4 – join date  DD.MM.YYYY  (Liitus)
        5 – leave date DD.MM.YYYY  (Lahkus) — empty string if still current

    Only rows that contain an 8-digit registry code in cell 2 are kept
    (this filters out the header row and any stray rows).
    """
    soup = BeautifulSoup(html, "html.parser")
    memberships: list[Membership] = []

    table = soup.find("table", id="party_table")
    if not isinstance(table, Tag):
        return memberships

    for row in table.find_all("tr"):
        cells = row.find_all("td")
        if len(cells) < 6:
            continue

        code_text = cells[2].get_text(strip=True)
        if not _RE_REGISTRY_CODE.fullmatch(code_text):
            continue

        party_name = cells[1].get_text(strip=True)
        registry_code = code_text

        joined_text = cells[4].get_text(strip=True)
        left_text = cells[5].get_text(strip=True)

        started_on = _parse_date(joined_text)
        ended_on = _parse_date(left_text) if left_text else None

        memberships.append(
            Membership(
                party_name=party_name,
                registry_code=registry_code,
                started_on=started_on,
                ended_on=ended_on,
            )
        )

    return memberships
