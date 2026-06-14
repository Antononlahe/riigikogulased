from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

Choice = Literal["yes", "no", "abstain", "absent", "neutral"]


def normalize_faction(name: str | None) -> str | None:
    """Map a Riigikogu faction label to a party name, or ``None`` for non-attached
    members.

    Members who belong to no fraktsioon are listed under a pseudo-faction
    ("Fraktsiooni mittekuuluvad ..." / fraktsiooni-mittekuuluvad-saadikud). They share
    no party line, so they must be stored with ``party_id = NULL`` and excluded from
    discipline scoring -- otherwise the views would score each independent against the
    "majority" of all other independents, which is meaningless. Returns the cleaned
    faction name otherwise.
    """
    if not name:
        return None
    cleaned = " ".join(name.split())
    if "mittekuuluv" in cleaned.lower():
        return None
    return cleaned or None


# Riigikogu fraktsioon names -> (short_name, full party name). Keeps the `parties`
# table keyed on stable abbreviations that match the seed in 0001_initial.sql, so the
# dashboard shows "RE"/"EKRE" rather than the long fraktsioon string and ingestion
# reuses the seeded rows instead of creating parallel ones.
_FACTION_TO_PARTY: dict[str, tuple[str, str]] = {
    "Eesti Reformierakonna fraktsioon": ("RE", "Eesti Reformierakond"),
    "Eesti Konservatiivse Rahvaerakonna fraktsioon": ("EKRE", "Eesti Konservatiivne Rahvaerakond"),
    "Eesti Keskerakonna fraktsioon": ("KE", "Eesti Keskerakond"),
    "Eesti 200 fraktsioon": ("E200", "Erakond Eesti 200"),
    "Sotsiaaldemokraatliku Erakonna fraktsioon": ("SDE", "Sotsiaaldemokraatlik Erakond"),
    "Isamaa fraktsioon": ("I", "Erakond Isamaa"),
}


def faction_to_party(name: str | None) -> tuple[str, str] | None:
    """Return ``(short_name, full_name)`` for a fraktsioon, or ``None`` for non-attached.

    Falls back to ``(faction, faction)`` for an unrecognized fraktsioon so a newly
    created or renamed faction never breaks ingestion (it just shows un-abbreviated).
    """
    n = normalize_faction(name)
    if n is None:
        return None
    return _FACTION_TO_PARTY.get(n, (n, n))


class VoteListEntry(BaseModel):
    """A row in the vote listing page."""

    riigikogu_uuid: UUID
    voted_at: datetime
    title: str
    detail_url: str
    # Procedural category slug derived from the vote TITLE (not the URL, whose slug
    # is always 'kohalolekukontroll'). See `vote_list.title_to_slug`. The two seeded
    # procedural titles map to 'kohalolekukontroll' and 'paevakorra-kinnitamine';
    # other titles get a normalized slug, e.g. 'lopphaaletus'. Used to filter
    # procedural votes out of discipline scoring.
    vote_type_slug: str | None = None


class Ballot(BaseModel):
    member_riigikogu_id: str
    member_full_name: str
    party_short_name: str | None = None
    choice: Choice


class VoteDetail(BaseModel):
    riigikogu_uuid: UUID
    voted_at: datetime
    title: str
    vote_type_slug: str | None = None
    agenda_item: str | None = None
    yes_count: int = 0
    no_count: int = 0
    abstain_count: int = 0
    absent_count: int = 0
    ballots: list[Ballot] = Field(default_factory=list)


class MemberSummary(BaseModel):
    riigikogu_id: str
    full_name: str
    party_short_name: str | None = None
    party_name: str | None = None
    party_since: date | None = None
