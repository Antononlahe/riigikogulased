from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta

import typer
from dotenv import load_dotenv

from parteidistsipliin_scraper import db
from parteidistsipliin_scraper.api_cache import ApiVoteCache
from parteidistsipliin_scraper.api_client import ApiClient
from parteidistsipliin_scraper.api_models import PlenaryMember, SittingGroup, Voting
from parteidistsipliin_scraper.ariregister_cache import AriregisterCache
from parteidistsipliin_scraper.ariregister_client import AriregisterClient
from parteidistsipliin_scraper.ariregister_models import (
    card_to_party_term,
    match_candidate,
    memberships_to_party_terms,
)
from parteidistsipliin_scraper.ariregister_parse import parse_member_history, parse_search_results
from parteidistsipliin_scraper.enrich import photo_download_url
from parteidistsipliin_scraper.photo import write_thumbnail
from parteidistsipliin_scraper.writer import (
    WriteContext,
    write_erakond_terms,
    write_member,
    write_sessions,
    write_voting,
)

load_dotenv()
app = typer.Typer(add_completion=False, help="Riigikogu API ingestion.")


def _new_context(cache: ApiVoteCache) -> WriteContext:
    return WriteContext(sessions=cache.read_sessions())


async def _fetch_sessions(client: ApiClient, cache: ApiVoteCache) -> None:
    cache.write_sessions(await client.get_json("/api/sessions"))


async def _scrape_range(start: date, end: date, *, cache_only: bool = False) -> int:
    cache = ApiVoteCache()
    if cache_only:
        async with ApiClient() as client:
            await _fetch_sessions(client, cache)
            return await _scrape_into(client, None, start, end, cache, None, cache_only=True)
    with db.connect() as conn:
        async with ApiClient() as client:
            await _fetch_sessions(client, cache)
            ctx = _new_context(cache)
            write_sessions(conn, ctx)
            return await _scrape_into(client, conn, start, end, cache, ctx)


async def _scrape_into(client, conn, start, end, cache, ctx, *, cache_only=False) -> int:
    n = 0
    cursor = start
    while cursor <= end:
        iso = cursor.isoformat()
        groups_raw = await client.get_json("/api/votings", {"startDate": iso, "endDate": iso})
        for g in (SittingGroup.model_validate(x) for x in groups_raw):
            for summary in g.votings:
                if cache.has(summary.uuid):
                    continue
                if not cache_only and db.vote_exists(conn, summary.uuid):
                    continue
                raw = await client.get_json(f"/api/votings/{summary.uuid}")
                cache.append_voting(raw)
                if not cache_only:
                    write_voting(conn, Voting.model_validate(raw), ctx)
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
    cache = ApiVoteCache()
    votings = cache.read_votings()
    members = cache.read_members()
    ctx = _new_context(cache)
    with db.connect() as conn:
        db.apply_migrations(conn)
        write_sessions(conn, ctx)
        for v in votings:
            write_voting(conn, v, ctx)
        today = date.today()
        for m in members:
            write_member(conn, m, ctx, today)
        ar_cache = AriregisterCache()
        for m in members:
            shtml = ar_cache.read_search(m.fullName)
            if shtml is None:
                continue
            cand = match_candidate(
                parse_search_results(shtml), full_name=m.fullName, date_of_birth=m.dateOfBirth
            )
            if cand is None:
                continue
            if cand.person_id:
                hhtml = ar_cache.read_history(cand.person_id)
                terms = memberships_to_party_terms(parse_member_history(hhtml)) if hhtml else []
            else:
                pt = card_to_party_term(cand.party_name)
                terms = [pt] if pt else []
            if terms:
                write_erakond_terms(conn, m.uuid, m.fullName, terms, ctx)
        conn.commit()
    typer.echo(
        f"Rebuilt {len(votings)} votings, {len(ctx.sitting_id_by_uuid)} sittings, "
        f"{len(members)} members from cache."
    )


@app.command()
def members() -> None:
    """Refresh members + factions + enrichment from /api/plenary-members."""
    asyncio.run(_refresh_members())


async def _refresh_members() -> None:
    cache = ApiVoteCache()
    with db.connect() as conn:
        async with ApiClient() as client:
            await _fetch_sessions(client, cache)
            raw = await client.get_json("/api/plenary-members")
        cache.write_members(raw)
        ctx = _new_context(cache)
        write_sessions(conn, ctx)
        today = date.today()
        members_list = [PlenaryMember.model_validate(m) for m in raw]
        for m in members_list:
            write_member(conn, m, ctx, today)
        conn.commit()
        typer.echo(f"Refreshed {len(members_list)} members.")


@app.command()
def photos() -> None:
    """Download member photos, compress to thumbnails, and record their paths."""
    asyncio.run(_refresh_photos())


async def _refresh_photos() -> None:
    cache = ApiVoteCache()
    members_list = cache.read_members()
    written = 0
    with db.connect() as conn:
        async with ApiClient() as client:
            for m in members_list:
                if m.photo is None:
                    continue
                mid = db.upsert_member(conn, m.uuid, m.fullName)
                data = await client.get_bytes(photo_download_url(m.photo.uuid))
                thumb_path = write_thumbnail(m.uuid, data)
                db.set_member_thumb(conn, mid, thumb_path)
                written += 1
        conn.commit()
    typer.echo(f"Wrote {written} member thumbnails.")


@app.command()
def erakond(
    refresh: bool = typer.Option(False, "--refresh", help="Re-fetch even if cached."),
) -> None:
    """Resolve each member's party (erakond) membership from the aariregister registry."""
    asyncio.run(_refresh_erakond(refresh))


async def _refresh_erakond(refresh: bool) -> None:
    api_cache = ApiVoteCache()
    members_list = api_cache.read_members()
    ar_cache = AriregisterCache()
    matched = unmatched = 0
    with db.connect() as conn:
        ctx = _new_context(api_cache)
        async with AriregisterClient() as client:
            for m in members_list:
                shtml = ar_cache.read_search(m.fullName)
                if shtml is None or refresh:
                    shtml = await client.search(m.fullName)
                    ar_cache.write_search(m.fullName, shtml)
                cand = match_candidate(
                    parse_search_results(shtml), full_name=m.fullName, date_of_birth=m.dateOfBirth
                )
                if cand is None:
                    unmatched += 1
                    continue
                if cand.person_id:
                    hhtml = ar_cache.read_history(cand.person_id)
                    if hhtml is None or refresh:
                        hhtml = await client.history(cand.person_id)
                        ar_cache.write_history(cand.person_id, hhtml)
                    terms = memberships_to_party_terms(parse_member_history(hhtml))
                else:
                    # No member-history link: the search card carries only the current party.
                    pt = card_to_party_term(cand.party_name)
                    terms = [pt] if pt else []
                if not terms:
                    unmatched += 1
                    continue
                write_erakond_terms(conn, m.uuid, m.fullName, terms, ctx)
                matched += 1
        conn.commit()
    typer.echo(f"Erakond: matched {matched}, unmatched {unmatched} of {len(members_list)} members.")
