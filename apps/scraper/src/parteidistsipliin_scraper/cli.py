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
from parteidistsipliin_scraper.eurovoc_cache import EurovocCache
from parteidistsipliin_scraper.eurovoc_models import (
    parse_draft_descriptor_edids,
    parse_draft_outcome,
    parse_fields,
)
from parteidistsipliin_scraper.lemmatize import lemmatize
from parteidistsipliin_scraper.photo import write_thumbnail
from parteidistsipliin_scraper.verbatim_cache import VerbatimCache
from parteidistsipliin_scraper.verbatim_parse import parse_sitting
from parteidistsipliin_scraper.writer import (
    WriteContext,
    write_erakond_terms,
    write_eurovoc_taxonomy,
    write_member,
    write_sessions,
    write_volume_topics,
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
            n = await _scrape_into(client, conn, start, end, cache, ctx)
            db.refresh_alignment(conn)
            conn.commit()
            return n


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
def migrate() -> None:
    """Apply any pending SQL migrations to the database (no data ingest).

    The migration files create their own objects (e.g. 0006 creates + populates the
    ballot_alignment materialized view), so no separate refresh is needed here.
    """
    with db.connect() as conn:
        ran = db.apply_migrations(conn)
    typer.echo(f"Applied migrations: {', '.join(ran) if ran else 'none (up to date)'}.")


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
        for m in members:
            write_member(conn, m, ctx, active=True)
        for m in cache.read_members_extra():
            write_member(conn, m, ctx, active=False)
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
        ec = EurovocCache()
        fields_et, fields_en = ec.read_fields("et"), ec.read_fields("en")
        if fields_et and fields_en:
            etids = sorted({m.etid for m in parse_fields(fields_et)[1]})
            micro = {
                lang: {etid: ec.read_microthes(etid, lang) for etid in etids
                       if ec.read_microthes(etid, lang) is not None}
                for lang in ("et", "en")
            }
            write_eurovoc_taxonomy(conn, fields_et, fields_en, micro["et"], micro["en"])
            for draft_uuid in db.distinct_draft_uuids(conn):
                raw = ec.read_draft(draft_uuid)
                if raw:
                    et = parse_draft_descriptor_edids(raw)
                    if et:
                        write_volume_topics(conn, draft_uuid, et)
        speech_raw = cache.read_speeches()
        if speech_raw:
            _ingest_speech_stats(conn, speech_raw, _TERM_START, None)
        # Replay cached verbatims -> searchable speeches (re-lemmatised). Needs the `nlp`
        # extra; skip (don't fail the rebuild) if EstNLTK isn't installed.
        verbatim_sittings = VerbatimCache().read_all()
        if verbatim_sittings:
            try:
                _ingest_verbatims(conn, verbatim_sittings, no_lemma=False)
            except ImportError:
                typer.echo("EstNLTK not installed; skipping verbatim speech index in rebuild.")
        conn.commit()
        db.refresh_alignment(conn)
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
            listed = [PlenaryMember.model_validate(m) for m in raw]
            for m in listed:
                write_member(conn, m, ctx, active=True)
            conn.commit()

            listed_ids = {m.uuid for m in listed}
            gap_ids = sorted(db.all_member_riigikogu_ids(conn) - listed_ids)
            extra_raw: list[dict] = []
            for uuid in gap_ids:
                rec = await client.get_json(f"/api/plenary-members/{uuid}")
                extra_raw.append(rec)
                write_member(conn, PlenaryMember.model_validate(rec), ctx, active=False)
            cache.write_members_extra(extra_raw)
            conn.commit()
        db.refresh_alignment(conn)
        conn.commit()
        typer.echo(f"Refreshed {len(listed)} active + {len(gap_ids)} former members.")


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
    """Resolve each member's party (erakond) membership from the ariregister registry."""
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
        db.refresh_alignment(conn)
        conn.commit()
    typer.echo(f"Erakond: matched {matched}, unmatched {unmatched} of {len(members_list)} members.")


@app.command()
def eurovoc(
    refresh: bool = typer.Option(False, "--refresh", help="Re-fetch even if cached."),
) -> None:
    """Ingest the Eurovoc taxonomy + each bill's subject descriptors."""
    asyncio.run(_refresh_eurovoc(refresh))


async def _refresh_eurovoc(refresh: bool) -> None:
    ec = EurovocCache()
    async with ApiClient() as client:
        # Fetch the taxonomy into the cache first, holding NO DB connection: the live
        # taxonomy fetch is ~256 calls at 1 req/s (~4 min), and a Neon connection left idle
        # that long is dropped by the pooler ("SSL connection has been closed unexpectedly")
        # before the first write. The draft phase below interleaves fetch+write (<=1s idle),
        # so it keeps its connection alive.
        fields = {}
        for lang in ("et", "en"):
            if refresh or ec.read_fields(lang) is None:
                raw = await client.get_json("/api/eurovoc/fields", {"lang": lang})
                ec.write_fields(lang, raw)
            fields[lang] = ec.read_fields(lang)
        etids = sorted({m.etid for m in parse_fields(fields["et"])[1]})
        micro = {"et": {}, "en": {}}
        for etid in etids:
            for lang in ("et", "en"):
                if refresh or ec.read_microthes(etid, lang) is None:
                    raw = await client.get_json(
                        "/api/eurovoc/microthes", {"etid": etid, "lang": lang}
                    )
                    ec.write_microthes(etid, lang, raw)
                micro[lang][etid] = ec.read_microthes(etid, lang)
        with db.connect() as conn:
            n = write_eurovoc_taxonomy(conn, fields["et"], fields["en"], micro["et"], micro["en"])
            conn.commit()
            n_drafts = await _ingest_draft_topics(client, conn, ec, refresh)
    typer.echo(
        f"Eurovoc: {len(etids)} microthesauruses, {n} descriptors, {n_drafts} bills linked."
    )


async def _ingest_draft_topics(client, conn, ec, refresh: bool) -> int:
    n = 0
    for draft_uuid in db.distinct_draft_uuids(conn):
        raw = ec.read_draft(draft_uuid)
        if raw is None or refresh:
            raw = await client.get_json(f"/api/volumes/drafts/{draft_uuid}")
            ec.write_draft(draft_uuid, raw)
        _write_draft_outcome(conn, draft_uuid, raw)
        edid_texts = parse_draft_descriptor_edids(raw)
        if edid_texts:
            write_volume_topics(conn, draft_uuid, edid_texts)
            n += 1
    conn.commit()
    return n


def _write_draft_outcome(conn, draft_uuid: str, raw: dict) -> None:
    """Persist a bill's final outcome (stage/status/accepted) from its draft JSON."""
    outcome = parse_draft_outcome(raw)
    db.upsert_draft_outcome(
        conn, draft_uuid=draft_uuid, stage=outcome.stage,
        status=outcome.status, accepted_on=outcome.accepted_on,
    )


# XV Riigikogu start (riigikogu_terms seed); the speech-stats window opens here.
_TERM_START = date(2023, 4, 10)


def _ingest_speech_stats(conn, raw: list[dict], start: date, end: date | None) -> int:
    """Upsert per-member speech counts from /api/statistics/speeches/plenary into the DB."""
    n = 0
    for m in raw:
        mid = db.member_id_by_riigikogu_id(conn, m["uuid"])
        if mid is None:
            continue  # a stats uuid we don't have as a member (shouldn't happen for XV)
        db.upsert_speech_stats(
            conn, member_id=mid,
            speeches=m.get("speeches") or 0, questions=m.get("questions") or 0,
            procedural=m.get("procedural") or 0, total=m.get("total") or 0,
            period_start=start, period_end=end,
        )
        n += 1
    return n


@app.command()
def speeches() -> None:
    """Ingest per-member plenary speech statistics (kõned/küsimused/protseduurilised)."""
    asyncio.run(_refresh_speeches())


def _month_ranges(start: date, end: date):
    """Yield (lo, hi) inclusive day ranges, one per calendar month, clipped to [start, end]."""
    cur = date(start.year, start.month, 1)
    while cur <= end:
        nxt = date(cur.year + 1, 1, 1) if cur.month == 12 else date(cur.year, cur.month + 1, 1)
        yield max(cur, start), min(nxt - timedelta(days=1), end)
        cur = nxt


def _ingest_verbatims(conn, sittings: list[dict], *, no_lemma: bool, chunk: int = 500) -> int:
    """Parse sittings -> member speeches, lemmatise, bulk-upsert. Returns speeches written.

    Writes are batched (chunked executemany) rather than one round-trip per speech: at ~5k
    speeches a remote per-row insert is dominated by ~100ms RTT each.
    """
    name_to_id = db.member_name_to_id(conn)
    batch: list[tuple] = []
    n = 0
    for sitting in sittings:
        for rec in parse_sitting(sitting, name_to_id):
            lemmas = None if no_lemma else lemmatize(rec.text)
            batch.append((
                rec.member_id, rec.speech_key, rec.speaker_uuid, rec.spoken_at,
                rec.sitting_date, rec.agenda_title, rec.steno_link, rec.text, lemmas,
            ))
            if len(batch) >= chunk:
                db.upsert_speeches(conn, batch)
                n += len(batch)
                batch = []
    db.upsert_speeches(conn, batch)
    n += len(batch)
    return n


@app.command()
def verbatims(
    start: datetime = typer.Option(..., "--from", help="Inclusive start date (YYYY-MM-DD)."),  # noqa: B008
    end: datetime | None = typer.Option(None, "--to", help="Inclusive end date; default today."),  # noqa: B008
    cache_only: bool = typer.Option(False, "--cache-only", help="Fetch + cache only, no DB."),
    no_lemma: bool = typer.Option(False, "--no-lemma", help="Skip lemmatisation."),
) -> None:
    """Ingest sitting stenograms -> per-member searchable speeches (Vabamorf-lemmatised).

    Fetches /api/steno/verbatims month by month, archives each sitting (gzip), and indexes
    every member-attributed SPEECH event. Needs the `nlp` extra (EstNLTK) unless --no-lemma.
    """
    end_date = (end or datetime.now()).date()
    cache = VerbatimCache()
    # Fetch is async (rate-limited API); the long lemmatise+DB ingest is plain synchronous
    # and runs OUTSIDE asyncio.run -- running ~25 min of blocking work inside the event loop
    # tripped a "loop stopped before Future completed" teardown that rolled back the ingest.
    sittings = asyncio.run(_fetch_verbatims(cache, start.date(), end_date))
    typer.echo(f"Fetched {len(sittings)} sittings between {start.date()} and {end_date}.")
    if cache_only:
        return
    with db.connect() as conn:
        n = _ingest_verbatims(conn, sittings, no_lemma=no_lemma)
        conn.commit()
    typer.echo(f"Indexed {n} speeches.")


async def _fetch_verbatims(cache: VerbatimCache, start: date, end: date) -> list[dict]:
    sittings: list[dict] = []
    async with ApiClient() as client:
        for lo, hi in _month_ranges(start, end):
            raw = await client.get_json(
                "/api/steno/verbatims", {"startDate": lo.isoformat(), "endDate": hi.isoformat()}
            )
            for sitting in raw:
                cache.write_sitting(sitting)
                sittings.append(sitting)
    return sittings


async def _refresh_speeches() -> None:
    cache = ApiVoteCache()
    end = date.today()
    async with ApiClient() as client:
        raw = await client.get_json(
            "/api/statistics/speeches/plenary",
            {"startDate": _TERM_START.isoformat(), "endDate": end.isoformat(), "lang": "et"},
        )
    cache.write_speeches(raw)
    with db.connect() as conn:
        n = _ingest_speech_stats(conn, raw, _TERM_START, end)
        conn.commit()
    typer.echo(f"Speech stats: {n} members of {len(raw)} ingested.")


@app.command()
def drafts(
    refresh: bool = typer.Option(False, "--refresh", help="Re-fetch even if cached."),
) -> None:
    """Backfill each bill's final outcome (adopted/rejected/...) into draft_outcomes.

    Reads the draft endpoint for every draft_uuid referenced by a vote. Bills still in
    process resolve to a terminal stage later, so re-run (or --refresh) to keep current.
    """
    asyncio.run(_refresh_draft_outcomes(refresh))


async def _refresh_draft_outcomes(refresh: bool) -> None:
    ec = EurovocCache()
    n = fetched = 0
    async with ApiClient() as client:
        with db.connect() as conn:
            for draft_uuid in db.distinct_draft_uuids(conn):
                raw = ec.read_draft(draft_uuid)
                if raw is None or refresh:
                    raw = await client.get_json(f"/api/volumes/drafts/{draft_uuid}")
                    ec.write_draft(draft_uuid, raw)
                    fetched += 1
                _write_draft_outcome(conn, draft_uuid, raw)
                n += 1
            conn.commit()
    typer.echo(f"Draft outcomes: {n} bills ({fetched} fetched, rest from cache).")
