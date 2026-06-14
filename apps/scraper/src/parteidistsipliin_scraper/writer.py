"""Map API-native objects into the v0.1 DB schema, preserving party-term tracking."""

from __future__ import annotations

from datetime import date

from parteidistsipliin_scraper import db
from parteidistsipliin_scraper.api_models import PlenaryMember, Voting
from parteidistsipliin_scraper.api_parse import decision_to_choice, vote_type_slug
from parteidistsipliin_scraper.models import faction_to_party


def write_voting(
    conn,
    voting: Voting,
    member_id_by_uuid: dict[str, int],
    party_id_by_short: dict[str, int],
    member_party: dict[int, int | None],
) -> None:
    """Write one voting (members, parties, terms, vote, ballots) to the database.

    The three dicts carry per-run state so members/parties are touched only on first
    sighting and terms only on an actual party <-> non-attached change. Feed votings in
    chronological order.
    """
    vote_day = voting.startDateTime.date()
    ballot_rows: list[tuple[int, str]] = []
    for v in voting.voters:
        choice = decision_to_choice(v.decision.code)
        if choice is None:
            continue  # KOHAL etc. — not stored (matches v0.1; procedural)
        mid = member_id_by_uuid.get(v.uuid)
        if mid is None:
            mid = db.upsert_member(conn, v.uuid, v.fullName)
            member_id_by_uuid[v.uuid] = mid

        pid: int | None = None
        party = faction_to_party(v.faction.name if v.faction else None)
        if party is not None:
            short, full = party
            pid = party_id_by_short.get(short)
            if pid is None:
                pid = db.upsert_party(conn, short, full)
                party_id_by_short[short] = pid
        if mid not in member_party or member_party[mid] != pid:
            db.set_member_party(conn, mid, pid, vote_day)
            member_party[mid] = pid

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
    conn.commit()


def write_member(conn, m: PlenaryMember, today: date) -> None:
    """Upsert one member and set their current faction (None = non-attached)."""
    mid = db.upsert_member(conn, m.uuid, m.fullName)
    pid: int | None = None
    party = faction_to_party(_current_faction_name(m))
    if party is not None:
        short, full = party
        pid = db.upsert_party(conn, short, full)
    db.set_member_party(conn, mid, pid, today)


def _current_faction_name(m: PlenaryMember) -> str | None:
    for f in m.factions:
        if f.active:
            return f.name
    return m.factions[-1].name if m.factions else None
