"""Pure transforms from API objects into A2 domain rows. No DB, no network."""

from __future__ import annotations

from datetime import date
from typing import NamedTuple

from parteidistsipliin_scraper.api_models import PlenaryMember, Session

FILE_DOWNLOAD_URL = "https://api.riigikogu.ee/api/files/{uuid}/download"


def photo_download_url(photo_uuid: str) -> str:
    return FILE_DOWNLOAD_URL.format(uuid=photo_uuid)


class CommitteeTerm(NamedTuple):
    uuid: str
    name: str
    type_code: str
    role_code: str | None
    started_on: date | None
    ended_on: date | None


class DistrictTerm(NamedTuple):
    code: str
    name: str
    term_number: int


class MemberFields(NamedTuple):
    date_of_birth: date | None
    date_of_death: date | None
    gender: str | None
    email: str | None
    phone: str | None
    seniority_days: int | None
    mandate_started_on: date | None
    photo_uuid: str | None
    photo_file_name: str | None
    photo_url: str | None


def _span(s: Session) -> int:
    end = s.endDate or date.max
    return (end - s.startDate).days


def map_sitting_to_session(sitting_date: date, sessions: list[Session]) -> Session | None:
    """Session whose [startDate, endDate] contains the date; narrower range wins ties.

    KORRALINE sessions are disjoint, so at most one contains any given day. ERAKORRALINE
    sessions (often single-day) overlap the enclosing KORRALINE one; the narrower span is
    the more specific answer. On equal span, the later-starting session wins.
    """
    hits = [
        s for s in sessions
        if s.startDate <= sitting_date and (s.endDate is None or sitting_date <= s.endDate)
    ]
    if not hits:
        return None
    return min(hits, key=lambda s: (_span(s), -s.startDate.toordinal()))


def committee_terms(m: PlenaryMember) -> list[CommitteeTerm]:
    out: list[CommitteeTerm] = []
    for c in m.committees:
        mem = c.membership
        out.append(
            CommitteeTerm(
                uuid=c.uuid,
                name=c.name,
                type_code=c.type.code,
                role_code=mem.role.code if mem and mem.role else None,
                started_on=mem.startDate if mem else None,
                ended_on=mem.endDate if mem else None,
            )
        )
    return out


def district_terms(m: PlenaryMember) -> list[DistrictTerm]:
    return [
        DistrictTerm(
            code=d.electoralDistrict.code,
            name=d.electoralDistrict.value or d.electoralDistrict.code,
            term_number=d.membership,
        )
        for d in m.electoralDistrictHistory
    ]


def member_fields(m: PlenaryMember) -> MemberFields:
    photo_uuid = m.photo.uuid if m.photo else None
    return MemberFields(
        date_of_birth=m.dateOfBirth,
        date_of_death=m.dateOfDeath,
        gender=m.gender,
        email=m.email,
        phone=m.phone,
        seniority_days=m.parliamentSeniority,
        mandate_started_on=m.plenaryMembership.startDate if m.plenaryMembership else None,
        photo_uuid=photo_uuid,
        photo_file_name=m.photo.fileName if m.photo else None,
        photo_url=photo_download_url(photo_uuid) if photo_uuid else None,
    )
