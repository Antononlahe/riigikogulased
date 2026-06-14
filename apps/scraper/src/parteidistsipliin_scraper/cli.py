from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta

import typer
from dotenv import load_dotenv

from parteidistsipliin_scraper import db
from parteidistsipliin_scraper.cache import VoteCache
from parteidistsipliin_scraper.client import RiigikoguClient
from parteidistsipliin_scraper.models import Ballot, MemberSummary, VoteDetail, faction_to_party
from parteidistsipliin_scraper.parsers import parse_members, parse_vote_detail, parse_vote_list

load_dotenv()
app = typer.Typer(add_completion=False, help="Riigikogu vote scraper.")


def _fmt_et(d: date) -> str:
    return d.strftime("%d.%m.%Y")


async def _scrape_range(start: date, end: date, *, cache_only: bool = False) -> int:
    # psycopg sync connection — fine here; the per-vote DB work is small compared
    # to the rate-limited httpx fetches.
    cache = VoteCache()
    if cache_only:
        # Populate the on-disk cache from the network without touching the database.
        async with RiigikoguClient() as client:
            return await _scrape_into(client, None, start, end, cache, cache_only=True)
    with db.connect() as conn:
        async with RiigikoguClient() as client:
            return await _scrape_into(client, conn, start, end, cache)


async def _scrape_into(
    client, conn, start: date, end: date, cache: VoteCache, *, cache_only: bool = False
) -> int:
    n = 0
    cursor = start
    # In-process caches. The backfill writes to a possibly-distant Postgres, so every
    # round-trip is expensive (~250 ms to a us-west-2 endpoint from the EU). Members and
    # parties are stable across a run, and a member's faction only changes at the rare
    # party-switch boundary -- so we hit the DB for them only on first sighting or an
    # actual change, instead of re-upserting ~101 members on every single vote.
    member_id_by_rid: dict[str, int] = {}     # riigikogu_id    -> members.id
    party_id_by_short: dict[str, int] = {}    # party short_name -> parties.id
    member_party: dict[int, int | None] = {}  # members.id -> parties.id (None = non-attached)
    while cursor <= end:
        d = _fmt_et(cursor)
        # The live listing filters on startFrom/endTo (plus a redundant startDate).
        # Using startDate/endDate alone returns an empty list.
        list_html = await client.get(
            f"/tegevus/tooulevaade/haaletused/?startFrom={d}&endTo={d}&startDate={d}"
        )
        for entry in parse_vote_list(list_html):
            # The archive is immutable: once a vote is cached we never refetch it.
            if cache.has(entry.riigikogu_uuid):
                continue
            if not cache_only and db.vote_exists(conn, entry.riigikogu_uuid):
                continue
            detail_html = await client.get(entry.detail_url)
            detail = parse_vote_detail(
                detail_html,
                riigikogu_uuid=entry.riigikogu_uuid,
                vote_type_slug=entry.vote_type_slug,
            )
            cache.append(detail)
            if not cache_only:
                _write_vote(conn, detail, member_id_by_rid, party_id_by_short, member_party)
            n += 1
        cursor += timedelta(days=1)
    return n


def _write_vote(
    conn,
    detail: VoteDetail,
    member_id_by_rid: dict[str, int],
    party_id_by_short: dict[str, int],
    member_party: dict[int, int | None],
) -> None:
    """Write one parsed vote (members, parties, terms, vote, ballots) to the database.

    Shared by the network backfill and the offline cache rebuild. The three dicts carry
    per-run state so members/parties are touched only on first sighting and terms only
    on an actual party <-> non-attached change. Callers MUST feed votes in chronological
    order so party-term transitions are dated correctly.
    """
    vote_day = detail.voted_at.date()
    member_ids: dict[str, int] = {}
    for b in detail.ballots:
        mid = member_id_by_rid.get(b.member_riigikogu_id)
        if mid is None:
            mid = db.upsert_member(conn, _ballot_to_member(b))
            member_id_by_rid[b.member_riigikogu_id] = mid
        member_ids[b.member_riigikogu_id] = mid

        # Resolve the member's faction at the time of this vote to a party id
        # (None = non-attached). Touch member_party_terms only on an actual change --
        # including party <-> non-attached transitions, so a member who leaves a
        # fraktsioon gets their previous term closed (and a NULL term opened) instead
        # of appearing to belong to it forever.
        pid: int | None = None
        party = faction_to_party(b.party_short_name)
        if party is not None:
            short, full = party
            pid = party_id_by_short.get(short)
            if pid is None:
                pid = db.upsert_party(conn, short, full)
                party_id_by_short[short] = pid
        if mid not in member_party or member_party[mid] != pid:
            db.set_member_party(conn, mid, pid, vote_day)
            member_party[mid] = pid
    vote_id = db.upsert_vote(conn, detail)
    db.replace_ballots(conn, vote_id, member_ids, detail.ballots)
    conn.commit()


def _ballot_to_member(b: Ballot) -> MemberSummary:
    return MemberSummary(
        riigikogu_id=b.member_riigikogu_id,
        full_name=b.member_full_name,
        party_short_name=b.party_short_name,
    )


@app.command()
def backfill(
    start: datetime = typer.Option(  # noqa: B008 - Typer pattern
        ..., "--from", help="Inclusive start date (YYYY-MM-DD)."
    ),
    end: datetime | None = typer.Option(  # noqa: B008 - Typer pattern
        None, "--to", help="Inclusive end date (YYYY-MM-DD), defaults to today."
    ),
    cache_only: bool = typer.Option(
        False,
        "--cache-only",
        help="Fetch and write the on-disk cache only; do not touch the database.",
    ),
) -> None:
    """Scrape every sitting day in the given range (writes the cache + the database)."""
    end_date = (end or datetime.now()).date()
    start_date = start.date()
    n = asyncio.run(_scrape_range(start_date, end_date, cache_only=cache_only))
    verb = "Cached" if cache_only else "Ingested"
    typer.echo(f"{verb} {n} new votes between {start_date} and {end_date}.")


@app.command()
def rebuild() -> None:
    """Rebuild the database from the on-disk cache, with no network access.

    Use after changing the writer / discipline / party-term logic: wipe the data tables
    and run this to replay every cached vote in chronological order.
    """
    n = _rebuild_from_cache()
    typer.echo(f"Rebuilt {n} votes from cache.")


def _rebuild_from_cache() -> int:
    details = VoteCache().read_all()
    member_id_by_rid: dict[str, int] = {}
    party_id_by_short: dict[str, int] = {}
    member_party: dict[int, int | None] = {}
    with db.connect() as conn:
        for detail in details:
            _write_vote(conn, detail, member_id_by_rid, party_id_by_short, member_party)
    return len(details)


@app.command()
def daily() -> None:
    """Scrape yesterday's votes. Intended for the GitHub Actions cron."""
    target = date.today() - timedelta(days=1)
    n = asyncio.run(_scrape_range(target, target))
    typer.echo(f"Ingested {n} votes for {target}.")


@app.command()
def members() -> None:
    """Refresh members list + current factions."""
    asyncio.run(_refresh_members())


async def _refresh_members() -> None:
    with db.connect() as conn:
        async with RiigikoguClient() as client:
            html = await client.get("/riigikogu/koosseis/riigikogu-liikmed/")
        members = parse_members(html)
        today = date.today()
        for m in members:
            mid = db.upsert_member(conn, m)
            # Set the member's current party (None = non-attached). set_member_party
            # closes any disagreeing open term, so a member who has since left their
            # fraktsioon is correctly marked unaffiliated as of today.
            pid: int | None = None
            party = faction_to_party(m.party_short_name)
            if party is not None:
                short, full = party
                pid = db.upsert_party(conn, short, full)
            db.set_member_party(conn, mid, pid, today)
        conn.commit()
        typer.echo(f"Refreshed {len(members)} members.")
