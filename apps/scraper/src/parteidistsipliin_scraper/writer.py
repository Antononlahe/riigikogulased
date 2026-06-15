"""Map API-native objects into the DB schema, preserving party-term tracking."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from parteidistsipliin_scraper import db
from parteidistsipliin_scraper.api_models import PlenaryMember, Session, Voting
from parteidistsipliin_scraper.api_parse import decision_to_choice, vote_type_slug
from parteidistsipliin_scraper.ariregister_models import PartyTerm
from parteidistsipliin_scraper.enrich import (
    committee_terms,
    district_terms,
    map_sitting_to_session,
    member_fields,
)
from parteidistsipliin_scraper.models import faction_to_party

CURRENT_TERM = 15


@dataclass
class WriteContext:
    """Per-run caches so repeated entities are touched once. Not thread-safe."""

    member_id_by_uuid: dict[str, int] = field(default_factory=dict)
    party_id_by_short: dict[str, int] = field(default_factory=dict)
    member_party: dict[int, int | None] = field(default_factory=dict)
    sessions: list[Session] = field(default_factory=list)
    term_id_by_number: dict[int, int] = field(default_factory=dict)
    session_id_by_key: dict[tuple[int, int], int] = field(default_factory=dict)
    sitting_id_by_uuid: dict[str, int] = field(default_factory=dict)

    def term_id(self, conn, number: int) -> int:
        tid = self.term_id_by_number.get(number)
        if tid is None:
            tid = db.upsert_term(conn, number)
            self.term_id_by_number[number] = tid
        return tid


def write_sessions(conn, ctx: WriteContext) -> None:
    """Persist the cached sessions and populate ctx.session_id_by_key. Idempotent."""
    for s in ctx.sessions:
        tid = ctx.term_id(conn, s.membership)
        sid = db.upsert_session(
            conn, term_id=tid, number=s.number, type_code=s.type.code,
            started_on=s.startDate, ended_on=s.endDate,
        )
        ctx.session_id_by_key[(s.membership, s.number)] = sid
    conn.commit()


def write_erakond_terms(
    conn, member_uuid: str, full_name: str, terms: list[PartyTerm], ctx: WriteContext
) -> None:
    """Replace a member's erakond terms from parsed party-registry history."""
    mid = ctx.member_id_by_uuid.get(member_uuid)
    if mid is None:
        mid = db.upsert_member(conn, member_uuid, full_name)
        ctx.member_id_by_uuid[member_uuid] = mid
    db.replace_erakond_terms(conn, mid)
    for t in terms:
        pid = ctx.party_id_by_short.get(t.short)
        if pid is None:
            pid = db.upsert_party(conn, t.short, t.full)
            ctx.party_id_by_short[t.short] = pid
        db.set_member_erakond(
            conn, member_id=mid, party_id=pid, started_on=t.started_on, ended_on=t.ended_on
        )


def write_voting(conn, voting: Voting, ctx: WriteContext) -> None:
    """Write one voting (members, parties, terms, sitting, vote, ballots) chronologically."""
    vote_day = voting.startDateTime.date()
    ballot_rows: list[tuple[int, str]] = []
    for v in voting.voters:
        choice = decision_to_choice(v.decision.code)
        if choice is None:
            continue
        mid = ctx.member_id_by_uuid.get(v.uuid)
        if mid is None:
            mid = db.upsert_member(conn, v.uuid, v.fullName)
            ctx.member_id_by_uuid[v.uuid] = mid

        pid: int | None = None
        party = faction_to_party(v.faction.name if v.faction else None)
        if party is not None:
            short, full = party
            pid = ctx.party_id_by_short.get(short)
            if pid is None:
                pid = db.upsert_party(conn, short, full)
                ctx.party_id_by_short[short] = pid
        if mid not in ctx.member_party or ctx.member_party[mid] != pid:
            db.set_member_faction(conn, mid, pid, vote_day)
            ctx.member_party[mid] = pid

        ballot_rows.append((mid, choice))

    vote_id = db.upsert_vote(
        conn,
        riigikogu_uuid=str(voting.uuid),
        voted_at=voting.startDateTime,
        title=voting.description,
        vote_type_slug=vote_type_slug(voting.description),
        agenda_item=None,
        yes_count=voting.inFavor or 0,
        no_count=voting.against or 0,
        abstain_count=voting.abstained or 0,
        absent_count=voting.absent or 0,
    )
    db.replace_ballots(conn, vote_id, ballot_rows)

    sitting_id = _write_sitting(conn, voting, ctx, vote_day)
    draft = voting.relatedDraft
    db.link_vote(
        conn, vote_id=vote_id, sitting_id=sitting_id,
        draft_uuid=str(draft.uuid) if draft else None,
        draft_title=draft.title if draft else None,
        draft_mark=str(draft.mark) if draft and draft.mark is not None else None,
    )
    conn.commit()


def _write_sitting(conn, voting: Voting, ctx: WriteContext, vote_day: date) -> int | None:
    if voting.sitting is None:
        return None
    cached = ctx.sitting_id_by_uuid.get(voting.sitting.uuid)
    if cached is not None:
        return cached
    tid = ctx.term_id(conn, CURRENT_TERM)
    mapped = map_sitting_to_session(vote_day, ctx.sessions)
    session_id = (
        ctx.session_id_by_key.get((mapped.membership, mapped.number)) if mapped else None
    )
    sid = db.upsert_sitting(
        conn, riigikogu_uuid=str(voting.sitting.uuid), title=voting.sitting.title,
        sitting_date=vote_day, term_id=tid, session_id=session_id,
    )
    ctx.sitting_id_by_uuid[voting.sitting.uuid] = sid
    return sid


def write_member(conn, m: PlenaryMember, ctx: WriteContext, today: date) -> None:
    """Upsert a member, set current faction, and write enrichment + committee/district terms."""
    mid = ctx.member_id_by_uuid.get(m.uuid)
    if mid is None:
        mid = db.upsert_member(conn, m.uuid, m.fullName)
        ctx.member_id_by_uuid[m.uuid] = mid

    pid: int | None = None
    party = faction_to_party(_current_faction_name(m))
    if party is not None:
        short, full = party
        pid = ctx.party_id_by_short.get(short)
        if pid is None:
            pid = db.upsert_party(conn, short, full)
            ctx.party_id_by_short[short] = pid
    db.set_member_faction(conn, mid, pid, today)

    db.enrich_member(conn, mid, member_fields(m))
    for ct in committee_terms(m):
        cid = db.upsert_committee(
            conn, riigikogu_uuid=ct.uuid, name=ct.name, type_code=ct.type_code
        )
        db.set_member_committee(
            conn, member_id=mid, committee_id=cid, role_code=ct.role_code,
            started_on=ct.started_on, ended_on=ct.ended_on,
        )
    for dt in district_terms(m):
        did = db.upsert_district(conn, code=dt.code, name=dt.name)
        tid = ctx.term_id(conn, dt.term_number)
        db.set_member_district(conn, member_id=mid, district_id=did, term_id=tid)


def _current_faction_name(m: PlenaryMember) -> str | None:
    for f in m.factions:
        if f.active:
            return f.name
    return m.factions[-1].name if m.factions else None
