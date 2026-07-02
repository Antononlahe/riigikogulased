"""Pydantic models mirroring api.riigikogu.ee JSON.

API-native: fields are named as the API names them (camelCase). `extra='ignore'` keeps
ingestion robust to fields we don't model yet (the API exposes far more than the cutover
uses; A2 reads the same archived JSON for member enrichment).
"""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class _Api(BaseModel):
    model_config = ConfigDict(extra="ignore")


class CodeValue(_Api):
    code: str
    value: str | None = None


class CommitteeMembership(_Api):
    membershipNumber: int | None = None
    startDate: date | None = None
    endDate: date | None = None
    role: CodeValue | None = None


class Committee(_Api):
    uuid: str
    name: str
    type: CodeValue
    active: bool | None = None
    membership: CommitteeMembership | None = None


class DistrictRef(_Api):
    code: str
    value: str | None = None


class DistrictHistory(_Api):
    membership: int
    electoralDistrict: DistrictRef


class Sitting(_Api):
    uuid: str
    title: str | None = None
    volumeType: str | None = None


class RelatedDraft(_Api):
    uuid: str
    title: str | None = None
    mark: int | str | None = None


class RelatedDocument(_Api):
    """Non-draft subject of a voting (e.g. an umbusaldusavaldus letter)."""

    uuid: str | None = None
    title: str | None = None


class Session(_Api):
    membership: int
    number: int
    type: CodeValue
    startDate: date
    endDate: date | None = None


class Faction(_Api):
    uuid: str
    name: str


class Voter(_Api):
    uuid: str
    fullName: str
    firstName: str | None = None
    lastName: str | None = None
    active: bool | None = None
    faction: Faction | None = None
    decision: CodeValue


class Voting(_Api):
    """One individual voting (the `/api/votings/{uuid}` payload)."""

    uuid: str
    votingNumber: int | None = None
    type: CodeValue
    description: str
    startDateTime: datetime
    endDateTime: datetime | None = None
    present: int | None = None
    absent: int | None = None
    inFavor: int | None = None
    against: int | None = None
    neutral: int | None = None
    abstained: int | None = None
    voters: list[Voter] = []
    sitting: Sitting | None = None
    relatedDraft: RelatedDraft | None = None
    relatedDocument: RelatedDocument | None = None


class VotingSummary(_Api):
    """A voting as it appears nested in a sitting group from the list endpoint."""

    uuid: str
    type: CodeValue
    description: str | None = None
    startDateTime: datetime | None = None


class SittingGroup(_Api):
    """One element of `GET /api/votings?startDate=&endDate=` -- a sitting + its votings."""

    uuid: str
    title: str | None = None
    membership: int | None = None
    sittingDateTime: datetime | None = None
    votings: list[VotingSummary] = []


class Photo(_Api):
    uuid: str
    fileName: str | None = None


class PlenaryMembership(_Api):
    membershipNumber: int | None = None
    startDate: date | None = None
    endDate: date | None = None
    role: CodeValue | None = None  # LIIGE | ESIMEES | ASEESIMEES (Riigikogu juhatus role)


class MemberFaction(_Api):
    uuid: str
    name: str
    active: bool | None = None


class PlenaryMember(_Api):
    """The `/api/plenary-members` element."""

    uuid: str
    fullName: str
    firstName: str | None = None
    lastName: str | None = None
    active: bool | None = None
    email: str | None = None
    phone: str | None = None
    photo: Photo | None = None
    gender: str | None = None
    dateOfBirth: date | None = None
    dateOfDeath: date | None = None
    parliamentSeniority: int | None = None
    plenaryMembership: PlenaryMembership | None = None
    committees: list[Committee] = []
    electoralDistrictHistory: list[DistrictHistory] = []
    factions: list[MemberFaction] = []
