from __future__ import annotations

import asyncio
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path

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
from parteidistsipliin_scraper.election_cache import ElectionCache
from parteidistsipliin_scraper.election_parse import parse_election
from parteidistsipliin_scraper.enrich import photo_download_url
from parteidistsipliin_scraper.eurovoc_cache import EurovocCache
from parteidistsipliin_scraper.eurovoc_models import (
    parse_draft_descriptor_edids,
    parse_draft_outcome,
    parse_fields,
)
from parteidistsipliin_scraper.expense_parse import parse_year as parse_expense_year
from parteidistsipliin_scraper.lemmatize import lemmatize
from parteidistsipliin_scraper.photo import write_thumbnail
from parteidistsipliin_scraper.profile_cache import ProfileCache
from parteidistsipliin_scraper.profile_client import ProfileClient
from parteidistsipliin_scraper.profile_parse import parse_profile
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
            if n:  # nothing new -> alignment inputs unchanged, skip the ~8s exclusive-lock refresh
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
def thresholds() -> None:
    """Backfill votes.required_majority + document_title from the on-disk votings cache.

    One-off after migration 0022 (new votings get both at ingest; rebuild replays the
    cache through write_voting anyway). Offline; idempotent.
    """
    from parteidistsipliin_scraper.api_parse import required_majority, vote_type_slug

    cache = ApiVoteCache()
    rows = []
    for v in (Voting.model_validate(x) for x in cache.read_votings()):
        draft_title = v.relatedDraft.title if v.relatedDraft else None
        doc_title = v.relatedDocument.title if v.relatedDocument else None
        rm = required_majority(vote_type_slug(v.description), draft_title, doc_title)
        rows.append((rm, doc_title, v.uuid))
    with db.connect() as conn:
        with conn.cursor() as cur:
            cur.executemany(
                "UPDATE votes SET required_majority = %s, document_title = %s "
                "WHERE riigikogu_uuid = %s",
                rows,
            )
        conn.commit()
    n51 = sum(1 for r in rows if r[0] == "members")
    typer.echo(f"Classified {len(rows)} votings ({n51} need 51 votes).")


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
                    # The cached draft JSON also carries the bill's outcome; write it so an offline
                    # rebuild reproduces draft_outcomes (0009) instead of leaving the timeline's
                    # adopted/rejected badges NULL. Mirrors _ingest_draft_topics.
                    _write_draft_outcome(conn, draft_uuid, raw)
                    et = parse_draft_descriptor_edids(raw)
                    if et:
                        write_volume_topics(conn, draft_uuid, et)
        el_cache = ElectionCache()
        for ec_dir in sorted(el_cache.dir.glob("RK_*")) if el_cache.dir.exists() else []:
            code = ec_dir.name
            results_xml = el_cache.read(code, "RESULTS")
            cands_xml = el_cache.read(code, "ELECTION_CANDIDATES")
            if results_xml and cands_xml:
                _write_election_results(conn, parse_election(results_xml, cands_xml), code)
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
        db.refresh_signatures(conn)
        conn.commit()
        # Replay cached member profile pages -> CV data (bio, hobbies, universities, caucuses).
        prof_cache = ProfileCache()
        if prof_cache.read_all():
            _write_profiles(conn, prof_cache, sorted(db.all_member_riigikogu_ids(conn)))
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
        # No refresh_alignment here: write_member touches only enrichment/committee/district data,
        # none of which are inputs to ballot_alignment (faction terms come from voters[]).
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


@app.command()
def signatures() -> None:
    """Recompute signature words (distinctive lemmas per member + party) from member_speeches."""
    with db.connect() as conn:
        n = db.refresh_signatures(conn)
        conn.commit()
    typer.echo(
        f"Wrote {n} signature-term rows." if n else "signature_terms absent; run migrate first."
    )


@app.command()
def profiles(
    refresh: bool = typer.Option(False, "--refresh", help="Re-fetch even if cached."),
    fetch_only: bool = typer.Option(False, "--fetch-only", help="Fetch + cache only, no DB write."),
) -> None:
    """Scrape member profile pages -> gzip cache, then write CV data (bio, hobbies, groups) to DB.

    Profiles are fetched at 1 req/s. The raw HTML is cached (committed) so `rebuild` reproduces
    the DB with no network. Hobby/profession tagging is a separate step: `profiles-tag`.
    """
    with db.connect() as conn:
        uuids = sorted(db.all_member_riigikogu_ids(conn))
    cache = ProfileCache()
    fetched = asyncio.run(_fetch_profiles(cache, uuids, refresh))
    typer.echo(f"Fetched {fetched} profiles ({len(uuids)} members, rest cached).")
    if fetch_only:
        return
    with db.connect() as conn:
        n = _write_profiles(conn, cache, uuids)
        conn.commit()
    typer.echo(f"Wrote profile rows for {n} members.")


async def _fetch_profiles(cache: ProfileCache, uuids: list[str], refresh: bool) -> int:
    fetched = 0
    async with ProfileClient() as client:
        for uuid in uuids:
            if not refresh and cache.has(uuid):
                continue
            cache.write(uuid, await client.profile(uuid))
            fetched += 1
    return fetched


def _write_profiles(conn, cache: ProfileCache, uuids: list[str]) -> int:
    from parteidistsipliin_scraper.profile_tags import canonical_university, load_tag_map
    from parteidistsipliin_scraper.towns import coords_for

    tag_map = load_tag_map()
    hobby_map = tag_map.get("hobby", {})
    prof_map = tag_map.get("profession", {})
    misses: list[str] = []
    n = 0
    for uuid in uuids:
        html = cache.read(uuid)
        if html is None:
            continue
        mid = db.member_id_by_riigikogu_id(conn, uuid)
        if mid is None:
            continue
        p = parse_profile(html)
        coords = coords_for(p.birthplace_town)
        if p.birthplace_town and coords is None:
            misses.append(p.birthplace_town)
        db.write_member_profile(
            conn, mid, p,
            profession_tag=prof_map.get(uuid),
            hobbies=[(h, hobby_map.get(h, "Muu")) for h in p.hobbies_raw],
            universities=canonical_university(p.education_raw),
            coords=coords,
        )
        n += 1
    if misses:
        uniq = sorted(set(misses))
        typer.echo(f"  no coords for {len(uniq)} birthplaces (add to towns.py): {uniq}")
    return n


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
    # Members who appear in older stenograms under a previous surname (marriage/divorce). The
    # verbatim feed keys speeches by display name, so the old name must alias to the current
    # member or those speeches are dropped. ponytail: hardcoded -- add a line if another MP
    # changes name. Luisa Rõivas -> Luisa Värk (divorced 2025).
    for old, current in {"Luisa Rõivas": "Luisa Värk"}.items():
        if current in name_to_id:
            name_to_id.setdefault(old, name_to_id[current])
    batch: list[tuple] = []
    n = 0
    for sitting in sittings:
        for rec in parse_sitting(sitting, name_to_id):
            lemmas = None if no_lemma else lemmatize(rec.text)
            batch.append((
                rec.member_id, rec.speech_key, rec.speaker_uuid, rec.spoken_at,
                rec.sitting_date, rec.sitting_type, rec.agenda_title, rec.steno_link,
                rec.text, lemmas,
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
        if n and not no_lemma:
            db.refresh_signatures(conn)  # new lemmas landed -> refresh signature words
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


def _year_windows(start: date, end: date):
    """Yield contiguous, non-overlapping ~1-year [lo, hi] windows covering [start, end].

    The speech-stats endpoint returns 418 ("teapot") for ranges beyond ~2 years, so the
    term-long query has to be chunked. Windows don't overlap, so per-member counts sum cleanly.
    """
    lo = start
    while lo <= end:
        hi = min(lo + timedelta(days=364), end)
        yield lo, hi
        lo = hi + timedelta(days=1)


async def _refresh_speeches() -> None:
    cache = ApiVoteCache()
    end = date.today()
    merged: dict[str, dict] = {}
    async with ApiClient() as client:
        for lo, hi in _year_windows(_TERM_START, end):
            for m in await client.get_json(
                "/api/statistics/speeches/plenary",
                {"startDate": lo.isoformat(), "endDate": hi.isoformat(), "lang": "et"},
            ):
                acc = merged.setdefault(
                    m["uuid"],
                    {"uuid": m["uuid"], "speeches": 0, "questions": 0, "procedural": 0, "total": 0},
                )
                for k in ("speeches", "questions", "procedural", "total"):
                    acc[k] += m.get(k) or 0
    raw = list(merged.values())
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


_ELECTION_FILES = ("RESULTS", "ELECTION_CANDIDATES")


def _write_election_results(conn, candidates, election_code: str) -> tuple[int, int]:
    """Match candidates to members by name+DOB and upsert one row per member. Returns
    (elected_matched, substitute_matched).

    Elected candidates win priority (an MP elected outright is never recorded as a substitute)
    and may use a unique-DOB fallback for name mismatches (nickname / surname change) -- safe
    because the elected set is small. Non-elected candidates match by name+DOB ONLY: the full
    candidate pool is ~1000, so a DOB fallback there could hijack a member via a shared birthday.
    """
    by_name_dob = db.member_name_dob_to_id(conn)
    by_unique_dob = db.member_unique_dob_to_id(conn)
    # How many candidates share each DOB -- a DOB unique in the whole candidate pool can't
    # hijack the wrong member, so it's a safe fallback key even for non-elected candidates.
    cand_dob_counts = Counter(r.dob for r in candidates if r.dob)
    chosen: dict[int, object] = {}
    # Elected first so they take precedence over any same-member non-elected candidacy.
    for r in sorted(candidates, key=lambda r: not r.elected):
        if not r.dob:
            continue
        mid = by_name_dob.get((r.norm_name, r.dob))
        # DOB fallback for name mismatches (nickname / surname change, e.g. "Raul-Stig Rästa"
        # the member knows as "Stig Rästa"). Safe when the DOB is unique among members; for
        # non-elected candidates also require it unique among candidates (the pool is ~1000, so
        # a shared birthday could otherwise mis-map). by_unique_dob already enforces member side.
        if mid is None and (r.elected or cand_dob_counts[r.dob] == 1):
            mid = by_unique_dob.get(r.dob)
        if mid is None or mid in chosen:
            continue
        chosen[mid] = r
    for mid, r in chosen.items():
        db.upsert_election_result(
            conn, member_id=mid, election_code=election_code, party_code=r.party_code,
            district_number=r.district_number, personal_votes=r.personal_votes,
            quota=r.quota, elected=r.elected, mandate_type=r.mandate_type,
        )
    # Elected candidates who matched NO member never took their seat (declined to stay minister/
    # MEP/mayor -- e.g. Kõlvart). Persist them as election_candidates so the site can show
    # "would've been in but isn't". Non-elected (the low-vote long tail) are not stored.
    matched = set(chosen.values())
    for r in candidates:
        if r.elected and r not in matched and r.app_id:
            db.upsert_election_candidate(
                conn, election_code=election_code, app_id=int(r.app_id), forename=r.forename,
                surname=r.surname, party_code=r.party_code, district_number=r.district_number,
                personal_votes=r.personal_votes, mandate_type=r.mandate_type,
            )
    elected = sum(1 for r in chosen.values() if r.elected)
    return elected, len(chosen) - elected


@app.command()
def election(
    election_code: str = typer.Option("RK_2023", help="RIA election code, e.g. RK_2023."),
    refresh: bool = typer.Option(False, "--refresh", help="Re-fetch even if cached."),
) -> None:
    """Ingest per-MP personal votes + mandate type from the RIA election open data."""
    asyncio.run(_refresh_election(election_code, refresh))


async def _refresh_election(election_code: str, refresh: bool) -> None:
    import httpx

    cache = ElectionCache()
    base = f"https://opendata.valimised.ee/api/{election_code}"
    ua = (
        "parteidistsipliin-scraper/0.2 "
        "(+https://github.com/antononlahe/parteidistsipliin; RIA avaandmed)"
    )
    async with httpx.AsyncClient(timeout=30.0, headers={"User-Agent": ua}) as client:
        for i, file in enumerate(_ELECTION_FILES):
            if refresh or cache.read(election_code, file) is None:
                if i:
                    await asyncio.sleep(1.0)  # 1 req/s politeness
                resp = await client.get(f"{base}/{file}.xml")
                resp.raise_for_status()
                cache.write(election_code, file, resp.text)
    results = parse_election(
        cache.read(election_code, "RESULTS"), cache.read(election_code, "ELECTION_CANDIDATES")
    )
    with db.connect() as conn:
        elected, substitutes = _write_election_results(conn, results, election_code)
        conn.commit()
    typer.echo(
        f"Election {election_code}: {len(results)} candidates parsed; "
        f"matched {elected} elected + {substitutes} substitutes to members."
    )


_EXPENSE_DIR = Path(__file__).resolve().parents[2] / "cache" / "kuluhuvitised"


@app.command()
def kuluhuvitised() -> None:
    """Ingest per-MP expense compensations (kuluhüvitised) from the committed CSV summaries.

    koond_YYYY.csv (limit + spent) joined with liikide_YYYY.csv (category split) per year, matched
    to members by normalized name (the CSV has no DOB). No network; no alignment refresh (additive).
    """
    with db.connect() as conn:
        name_to_id = db.member_norm_name_to_id(conn)
        total = matched = 0
        unmatched: list[str] = []
        for year in (2023, 2024, 2025):
            koond = (_EXPENSE_DIR / f"koond_{year}.csv").read_text(encoding="utf-8")
            liikide = (_EXPENSE_DIR / f"liikide_{year}.csv").read_text(encoding="utf-8")
            for r in parse_expense_year(koond, liikide, year):
                total += 1
                mid = name_to_id.get(r.norm_name)
                if mid is None:
                    unmatched.append(f"{r.raw_name} ({year})")
                    continue
                db.upsert_member_expense(
                    conn, member_id=mid, year=year, limit_eur=r.limit_eur,
                    spent_eur=r.spent_eur, breakdown=r.breakdown,
                )
                matched += 1
        conn.commit()
    typer.echo(f"Kuluhüvitised: {matched}/{total} rows matched to members.")
    if unmatched:
        typer.echo(f"  unmatched ({len(unmatched)}): {', '.join(unmatched)}")
