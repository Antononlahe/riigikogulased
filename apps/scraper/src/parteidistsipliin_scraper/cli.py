from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta

import typer
from dotenv import load_dotenv

from parteidistsipliin_scraper import db
from parteidistsipliin_scraper.api_cache import ApiVoteCache
from parteidistsipliin_scraper.api_client import ApiClient
from parteidistsipliin_scraper.api_models import PlenaryMember, SittingGroup, Voting
from parteidistsipliin_scraper.writer import write_member, write_voting

load_dotenv()
app = typer.Typer(add_completion=False, help="Riigikogu API ingestion.")


async def _scrape_range(start: date, end: date, *, cache_only: bool = False) -> int:
    cache = ApiVoteCache()
    if cache_only:
        async with ApiClient() as client:
            return await _scrape_into(client, None, start, end, cache, cache_only=True)
    with db.connect() as conn:
        async with ApiClient() as client:
            return await _scrape_into(client, conn, start, end, cache)


async def _scrape_into(client, conn, start, end, cache, *, cache_only=False) -> int:
    n = 0
    member_id_by_uuid: dict[str, int] = {}
    party_id_by_short: dict[str, int] = {}
    member_party: dict[int, int | None] = {}
    cursor = start
    while cursor <= end:
        iso = cursor.isoformat()
        groups_raw = await client.get_json(
            "/api/votings", {"startDate": iso, "endDate": iso}
        )
        for g in (SittingGroup.model_validate(x) for x in groups_raw):
            for summary in g.votings:
                if cache.has(summary.uuid):
                    continue
                if not cache_only and db.vote_exists(conn, summary.uuid):
                    continue
                raw = await client.get_json(f"/api/votings/{summary.uuid}")
                cache.append_voting(raw)
                if not cache_only:
                    write_voting(
                        conn, Voting.model_validate(raw),
                        member_id_by_uuid, party_id_by_short, member_party,
                    )
                n += 1
        cursor += timedelta(days=1)
    return n


@app.command()
def backfill(
    start: datetime = typer.Option(..., "--from", help="Inclusive start date (YYYY-MM-DD)."),  # noqa: B008
    end: datetime | None = typer.Option(None, "--to", help="Inclusive end date; default today."),  # noqa: B008
    cache_only: bool = typer.Option(False, "--cache-only", help="Write the cache only."),
) -> None:
    """Ingest every sitting day in the range from the API (writes cache + database)."""
    end_date = (end or datetime.now()).date()
    n = asyncio.run(_scrape_range(start.date(), end_date, cache_only=cache_only))
    verb = "Cached" if cache_only else "Ingested"
    typer.echo(f"{verb} {n} new votings between {start.date()} and {end_date}.")


@app.command()
def daily() -> None:
    """Ingest yesterday's votings. Intended for the GitHub Actions cron."""
    target = date.today() - timedelta(days=1)
    n = asyncio.run(_scrape_range(target, target))
    typer.echo(f"Ingested {n} votings for {target}.")


@app.command()
def rebuild() -> None:
    """Rebuild the database from the on-disk API cache, with no network access."""
    votings = ApiVoteCache().read_votings()
    member_id_by_uuid: dict[str, int] = {}
    party_id_by_short: dict[str, int] = {}
    member_party: dict[int, int | None] = {}
    with db.connect() as conn:
        for v in votings:
            write_voting(conn, v, member_id_by_uuid, party_id_by_short, member_party)
    typer.echo(f"Rebuilt {len(votings)} votings from cache.")


@app.command()
def members() -> None:
    """Refresh members + current factions from /api/plenary-members."""
    asyncio.run(_refresh_members())


async def _refresh_members() -> None:
    cache = ApiVoteCache()
    with db.connect() as conn:
        async with ApiClient() as client:
            raw = await client.get_json("/api/plenary-members")
        cache.write_members(raw)
        today = date.today()
        members_list = [PlenaryMember.model_validate(m) for m in raw]
        for m in members_list:
            write_member(conn, m, today)
        conn.commit()
        typer.echo(f"Refreshed {len(members_list)} members.")
