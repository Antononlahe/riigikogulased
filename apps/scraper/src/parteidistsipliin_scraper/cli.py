from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta

import typer
from dotenv import load_dotenv

from parteidistsipliin_scraper import db
from parteidistsipliin_scraper.client import RiigikoguClient
from parteidistsipliin_scraper.models import Ballot, MemberSummary
from parteidistsipliin_scraper.parsers import parse_members, parse_vote_detail, parse_vote_list

load_dotenv()
app = typer.Typer(add_completion=False, help="Riigikogu vote scraper.")


def _fmt_et(d: date) -> str:
    return d.strftime("%d.%m.%Y")


async def _scrape_range(start: date, end: date) -> int:
    # psycopg sync connection — fine here; the per-vote DB work is small compared
    # to the rate-limited httpx fetches.
    with db.connect() as conn:
        async with RiigikoguClient() as client:
            return await _scrape_into(client, conn, start, end)


async def _scrape_into(client, conn, start: date, end: date) -> int:
    n = 0
    cursor = start
    # In-process caches. The backfill writes to a possibly-distant Postgres, so every
    # round-trip is expensive (~250 ms to a us-west-2 endpoint from the EU). Members and
    # parties are stable across a run, and a member's faction only changes at the rare
    # party-switch boundary -- so we hit the DB for them only on first sighting or an
    # actual change, instead of re-upserting ~101 members on every single vote.
    member_id_by_rid: dict[str, int] = {}     # riigikogu_id -> members.id
    party_id_by_name: dict[str, int] = {}     # faction name  -> parties.id
    member_party: dict[int, int] = {}         # members.id    -> current parties.id
    while cursor <= end:
        d = _fmt_et(cursor)
        # The live listing filters on startFrom/endTo (plus a redundant startDate).
        # Using startDate/endDate alone returns an empty list.
        list_html = await client.get(
            f"/tegevus/tooulevaade/haaletused/?startFrom={d}&endTo={d}&startDate={d}"
        )
        for entry in parse_vote_list(list_html):
            if db.vote_exists(conn, entry.riigikogu_uuid):
                continue
            detail_html = await client.get(entry.detail_url)
            detail = parse_vote_detail(
                detail_html,
                riigikogu_uuid=entry.riigikogu_uuid,
                vote_type_slug=entry.vote_type_slug,
            )
            vote_day = detail.voted_at.date()
            member_ids: dict[str, int] = {}
            for b in detail.ballots:
                mid = member_id_by_rid.get(b.member_riigikogu_id)
                if mid is None:
                    mid = db.upsert_member(conn, _ballot_to_member(b))
                    member_id_by_rid[b.member_riigikogu_id] = mid
                member_ids[b.member_riigikogu_id] = mid
                if b.party_short_name:
                    pid = party_id_by_name.get(b.party_short_name)
                    if pid is None:
                        pid = db.upsert_party(conn, b.party_short_name)
                        party_id_by_name[b.party_short_name] = pid
                    # Touch member_party_terms only when the faction actually changes
                    # (first sighting in this run, or a genuine party switch).
                    if member_party.get(mid) != pid:
                        db.set_member_party(conn, mid, pid, vote_day)
                        member_party[mid] = pid
            vote_id = db.upsert_vote(conn, detail)
            db.replace_ballots(conn, vote_id, member_ids, detail.ballots)
            conn.commit()
            n += 1
        cursor += timedelta(days=1)
    return n


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
) -> None:
    """Scrape every sitting day in the given range."""
    end_date = (end or datetime.now()).date()
    start_date = start.date()
    n = asyncio.run(_scrape_range(start_date, end_date))
    typer.echo(f"Ingested {n} new votes between {start_date} and {end_date}.")


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
            html = await client.get("/riigikogu-liikmed/")
        members = parse_members(html)
        today = date.today()
        for m in members:
            mid = db.upsert_member(conn, m)
            if m.party_short_name:
                pid = db.upsert_party(conn, m.party_short_name, m.party_name)
                db.set_member_party(conn, mid, pid, today)
        conn.commit()
        typer.echo(f"Refreshed {len(members)} members.")
