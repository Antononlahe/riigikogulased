from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

Choice = Literal["yes", "no", "abstain", "absent", "neutral"]


class VoteListEntry(BaseModel):
    """A row in the vote listing page."""

    riigikogu_uuid: UUID
    voted_at: datetime
    title: str
    detail_url: str
    # URL slug between 'haaletustulemused-' and the UUID; identifies the vote's
    # procedural category, e.g. 'kohalolekukontroll', 'paevakorra-kinnitamine',
    # 'lopphaaletus'. Used to filter procedural votes out of discipline scoring.
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
