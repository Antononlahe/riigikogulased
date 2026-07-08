from __future__ import annotations

import os
import re
from datetime import date
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from parteidistsipliin_scraper.election_parse import normalize_name


def _slugify(name: str) -> str:
    s = name.lower()
    repl = {"õ": "o", "ä": "a", "ö": "o", "ü": "u", "š": "s", "ž": "z"}
    for k, v in repl.items():
        s = s.replace(k, v)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "member"


def connect() -> psycopg.Connection:
    url = os.environ["DATABASE_URL"]
    return psycopg.connect(url, row_factory=dict_row)


def upsert_party(
    conn: psycopg.Connection, short_name: str, name: str | None = None,
    registry_code: str | None = None,
) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO parties (short_name, name, registry_code)
            VALUES (%s, %s, %s)
            ON CONFLICT (short_name) DO UPDATE
              SET name = COALESCE(EXCLUDED.name, parties.name),
                  registry_code = COALESCE(EXCLUDED.registry_code, parties.registry_code)
            RETURNING id
            """,
            (short_name, name or short_name, registry_code),
        )
        row = cur.fetchone()
        assert row is not None
        return row["id"]


def upsert_member(conn: psycopg.Connection, riigikogu_id: str, full_name: str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO members (riigikogu_id, full_name, slug)
            VALUES (%s, %s, %s)
            ON CONFLICT (riigikogu_id) DO UPDATE
              SET full_name = EXCLUDED.full_name
            RETURNING id
            """,
            (riigikogu_id, full_name, _slugify(full_name)),
        )
        row = cur.fetchone()
        assert row is not None
        return row["id"]


def set_member_faction(
    conn: psycopg.Connection,
    member_id: int,
    party_id: int | None,
    started_on: date,
) -> None:
    """Close any open faction term that disagrees, then open a new one if needed."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, party_id FROM member_faction_terms "
            "WHERE member_id = %s AND ended_on IS NULL",
            (member_id,),
        )
        current = cur.fetchone()
        if current and current["party_id"] == party_id:
            return
        if current:
            cur.execute(
                "UPDATE member_faction_terms SET ended_on = %s WHERE id = %s",
                (started_on, current["id"]),
            )
        cur.execute(
            "INSERT INTO member_faction_terms (member_id, party_id, started_on) "
            "VALUES (%s, %s, %s)",
            (member_id, party_id, started_on),
        )


def replace_erakond_terms(conn: psycopg.Connection, member_id: int) -> None:
    """Delete a member's erakond terms (re-run from scratch each ingest)."""
    with conn.cursor() as cur:
        cur.execute("DELETE FROM member_erakond_terms WHERE member_id = %s", (member_id,))


def set_member_erakond(
    conn: psycopg.Connection, *, member_id: int, party_id: int | None,
    started_on: date | None, ended_on: date | None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO member_erakond_terms (member_id, party_id, started_on, ended_on) "
            "VALUES (%s, %s, %s, %s)",
            (member_id, party_id, started_on, ended_on),
        )


def upsert_vote(
    conn: psycopg.Connection,
    *,
    riigikogu_uuid: str,
    voted_at,
    title: str,
    vote_type_slug: str | None,
    agenda_item: str | None,
    yes_count: int,
    no_count: int,
    abstain_count: int,
    absent_count: int,
) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO votes (
              riigikogu_uuid, voted_at, title, vote_type_slug, agenda_item,
              yes_count, no_count, abstain_count, absent_count
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (riigikogu_uuid) DO UPDATE SET
              voted_at = EXCLUDED.voted_at,
              title = EXCLUDED.title,
              vote_type_slug = EXCLUDED.vote_type_slug,
              agenda_item = EXCLUDED.agenda_item,
              yes_count = EXCLUDED.yes_count,
              no_count = EXCLUDED.no_count,
              abstain_count = EXCLUDED.abstain_count,
              absent_count = EXCLUDED.absent_count
            RETURNING id
            """,
            (
                riigikogu_uuid, voted_at, title, vote_type_slug, agenda_item,
                yes_count, no_count, abstain_count, absent_count,
            ),
        )
        row = cur.fetchone()
        assert row is not None
        return row["id"]


def replace_ballots(
    conn: psycopg.Connection,
    vote_id: int,
    rows: list[tuple[int, str]],
) -> None:
    """Replace a vote's ballots. `rows` is a list of (member_id, choice)."""
    with conn.cursor() as cur:
        cur.execute("DELETE FROM ballots WHERE vote_id = %s", (vote_id,))
        cur.executemany(
            "INSERT INTO ballots (vote_id, member_id, choice) VALUES (%s, %s, %s)",
            [(vote_id, mid, choice) for mid, choice in rows],
        )


def vote_exists(conn: psycopg.Connection, riigikogu_uuid) -> bool:
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM votes WHERE riigikogu_uuid = %s", (str(riigikogu_uuid),))
        return cur.fetchone() is not None


MIGRATIONS_DIR = Path(__file__).resolve().parents[4] / "packages" / "db" / "migrations"


def pending_migrations(applied: set[str], migrations_dir: Path | None = None) -> list[Path]:
    """Migration files (NNNN_*.sql) whose version prefix is not yet applied, in order."""
    d = migrations_dir or MIGRATIONS_DIR
    files = sorted(d.glob("[0-9][0-9][0-9][0-9]_*.sql"))
    return [f for f in files if f.name.split("_", 1)[0] not in applied]


def _applied_versions(conn: psycopg.Connection) -> set[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT to_regclass('schema_migrations') IS NOT NULL AS present")
        row = cur.fetchone()
        if not row or not row["present"]:
            return set()
        cur.execute("SELECT version FROM schema_migrations")
        return {r["version"] for r in cur.fetchall()}


# A lone `BEGIN;` / `COMMIT;` line: older migrations wrap their whole body in one. apply_migrations
# strips these so the body and its schema_migrations bookkeeping commit as a single transaction.
_OUTER_TXN = re.compile(r"(?im)^[ \t]*(?:begin|commit)[ \t]*;[ \t]*$")


def apply_migrations(conn: psycopg.Connection, migrations_dir: Path | None = None) -> list[str]:
    """Apply every unapplied NNNN_*.sql in order; record each in schema_migrations.

    The migration body and its schema_migrations version row commit as ONE transaction: we strip
    the file's own outer BEGIN;/COMMIT; and let this function own the commit. Otherwise a crash
    between the file's COMMIT and a separate version INSERT would leave a migration
    applied-but-unrecorded, and the next run would re-execute a non-idempotent body (0003's RENAME,
    0014's DROP EXPRESSION) and wedge the whole chain. Assumes migrations use BEGIN/COMMIT only as
    an outer wrapper, never to split the body into independently-committed parts. The tracking
    table is created up front because the earliest migrations (0001) predate it.
    """
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations ("
        "  version TEXT PRIMARY KEY,"
        "  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()"
        ")"
    )
    conn.commit()
    applied = _applied_versions(conn)
    ran: list[str] = []
    for path in pending_migrations(applied, migrations_dir):
        version = path.name.split("_", 1)[0]
        conn.execute(_OUTER_TXN.sub("", path.read_text(encoding="utf-8")))
        conn.execute(
            "INSERT INTO schema_migrations (version) VALUES (%s) "
            "ON CONFLICT (version) DO NOTHING",
            (version,),
        )
        conn.commit()
        ran.append(version)
    return ran


def refresh_alignment(conn: psycopg.Connection) -> None:
    """Refresh the ballot_alignment materialized view (cache of member_vote_alignment).

    Call after any ingest that changes ballots, votes, or faction/erakond terms so the
    cached per-ballot alignment matches the source views. No-op-safe to call repeatedly.
    """
    conn.execute("REFRESH MATERIALIZED VIEW ballot_alignment")


def upsert_term(conn: psycopg.Connection, number: int) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO riigikogu_terms (number) VALUES (%s) "
            "ON CONFLICT (number) DO UPDATE SET number = EXCLUDED.number RETURNING id",
            (number,),
        )
        row = cur.fetchone()
        assert row is not None
        return row["id"]


def upsert_session(
    conn: psycopg.Connection, *, term_id: int, number: int, type_code: str,
    started_on: date, ended_on: date | None,
) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO sessions (term_id, number, type_code, started_on, ended_on)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (term_id, number) DO UPDATE SET
              type_code = EXCLUDED.type_code,
              started_on = EXCLUDED.started_on,
              ended_on = EXCLUDED.ended_on
            RETURNING id
            """,
            (term_id, number, type_code, started_on, ended_on),
        )
        row = cur.fetchone()
        assert row is not None
        return row["id"]


def upsert_sitting(
    conn: psycopg.Connection, *, riigikogu_uuid: str, title: str | None,
    sitting_date: date, term_id: int | None, session_id: int | None,
) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO sittings (riigikogu_uuid, title, sitting_date, term_id, session_id)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (riigikogu_uuid) DO UPDATE SET
              title = COALESCE(EXCLUDED.title, sittings.title),
              sitting_date = LEAST(sittings.sitting_date, EXCLUDED.sitting_date),
              term_id = COALESCE(EXCLUDED.term_id, sittings.term_id),
              session_id = COALESCE(EXCLUDED.session_id, sittings.session_id)
            RETURNING id
            """,
            (riigikogu_uuid, title, sitting_date, term_id, session_id),
        )
        row = cur.fetchone()
        assert row is not None
        return row["id"]


def upsert_committee(
    conn: psycopg.Connection, *, riigikogu_uuid: str, name: str, type_code: str
) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO committees (riigikogu_uuid, name, type_code)
            VALUES (%s, %s, %s)
            ON CONFLICT (riigikogu_uuid) DO UPDATE SET
              name = EXCLUDED.name, type_code = EXCLUDED.type_code
            RETURNING id
            """,
            (riigikogu_uuid, name, type_code),
        )
        row = cur.fetchone()
        assert row is not None
        return row["id"]


def set_member_committee(
    conn: psycopg.Connection, *, member_id: int, committee_id: int,
    role_code: str | None, started_on: date | None, ended_on: date | None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO member_committee_terms
              (member_id, committee_id, role_code, started_on, ended_on)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (member_id, committee_id, started_on) DO UPDATE SET
              role_code = EXCLUDED.role_code, ended_on = EXCLUDED.ended_on
            """,
            (member_id, committee_id, role_code, started_on, ended_on),
        )


def upsert_district(conn: psycopg.Connection, *, code: str, name: str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO electoral_districts (code, name) VALUES (%s, %s) "
            "ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id",
            (code, name),
        )
        row = cur.fetchone()
        assert row is not None
        return row["id"]


def set_member_district(
    conn: psycopg.Connection, *, member_id: int, district_id: int, term_id: int
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO member_district_terms (member_id, district_id, term_id) "
            "VALUES (%s, %s, %s) ON CONFLICT (member_id, district_id, term_id) DO NOTHING",
            (member_id, district_id, term_id),
        )


def enrich_member(conn: psycopg.Connection, member_id: int, f) -> None:
    """Update a members row from an enrich.MemberFields (thumb_path left untouched)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE members SET
              date_of_birth = %s, date_of_death = %s, gender = %s,
              email = %s, phone = %s, parliament_seniority_days = %s,
              mandate_started_on = %s, photo_uuid = %s,
              photo_file_name = %s, photo_url = %s, board_role = %s
            WHERE id = %s
            """,
            (
                f.date_of_birth, f.date_of_death, f.gender, f.email, f.phone,
                f.seniority_days, f.mandate_started_on, f.photo_uuid,
                f.photo_file_name, f.photo_url, f.board_role, member_id,
            ),
        )


def set_member_active(conn: psycopg.Connection, member_id: int, active: bool) -> None:
    with conn.cursor() as cur:
        cur.execute("UPDATE members SET active = %s WHERE id = %s", (active, member_id))


def all_member_riigikogu_ids(conn: psycopg.Connection) -> set[str]:
    """Every member's riigikogu_id (uuid) currently in the DB."""
    with conn.cursor() as cur:
        cur.execute("SELECT riigikogu_id FROM members")
        return {r["riigikogu_id"] for r in cur.fetchall()}


def set_member_thumb(conn: psycopg.Connection, member_id: int, thumb_path: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE members SET photo_thumb_path = %s WHERE id = %s",
            (thumb_path, member_id),
        )


def link_vote(
    conn: psycopg.Connection, *, vote_id: int, sitting_id: int | None,
    draft_uuid: str | None, draft_title: str | None, draft_mark: str | None,
    document_title: str | None, required_majority: str,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE votes SET sitting_id = %s, draft_uuid = %s, "
            "draft_title = %s, draft_mark = %s, document_title = %s, "
            "required_majority = %s WHERE id = %s",
            (sitting_id, draft_uuid, draft_title, draft_mark, document_title,
             required_majority, vote_id),
        )


def upsert_eurovoc_field(
    conn: psycopg.Connection, *, efid: int, uuid: str, code: str | None,
    text_et: str, text_en: str | None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO eurovoc_fields (efid, uuid, code, text_et, text_en)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (efid) DO UPDATE SET
              uuid=EXCLUDED.uuid, code=EXCLUDED.code,
              text_et=EXCLUDED.text_et, text_en=COALESCE(EXCLUDED.text_en, eurovoc_fields.text_en)
            """,
            (efid, uuid, code, text_et, text_en),
        )


def upsert_eurovoc_microthes(
    conn: psycopg.Connection, *, etid: int, uuid: str, code: str | None,
    text_et: str, text_en: str | None, field_efid: int | None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO eurovoc_microthesauri (etid, uuid, code, text_et, text_en, field_efid)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (etid) DO UPDATE SET
              uuid=EXCLUDED.uuid, code=EXCLUDED.code, text_et=EXCLUDED.text_et,
              text_en=COALESCE(EXCLUDED.text_en, eurovoc_microthesauri.text_en),
              field_efid=COALESCE(EXCLUDED.field_efid, eurovoc_microthesauri.field_efid)
            """,
            (etid, uuid, code, text_et, text_en, field_efid),
        )


def upsert_eurovoc_descriptor(
    conn: psycopg.Connection, *, edid: int, uuid: str | None, code: str | None,
    text_et: str, text_en: str | None, microthesaurus_etid: int | None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO eurovoc_descriptors
              (edid, uuid, code, text_et, text_en, microthesaurus_etid)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (edid) DO UPDATE SET
              uuid=COALESCE(EXCLUDED.uuid, eurovoc_descriptors.uuid), code=EXCLUDED.code,
              text_et=EXCLUDED.text_et,
              text_en=COALESCE(EXCLUDED.text_en, eurovoc_descriptors.text_en),
              microthesaurus_etid=COALESCE(
                EXCLUDED.microthesaurus_etid, eurovoc_descriptors.microthesaurus_etid)
            """,
            (edid, uuid, code, text_et, text_en, microthesaurus_etid),
        )


def add_volume_topic(conn: psycopg.Connection, *, draft_uuid: str, descriptor_edid: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO volume_topics (draft_uuid, descriptor_edid) VALUES (%s, %s) "
            "ON CONFLICT (draft_uuid, descriptor_edid) DO NOTHING",
            (draft_uuid, descriptor_edid),
        )


def distinct_draft_uuids(conn: psycopg.Connection) -> list[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT DISTINCT draft_uuid::text FROM votes WHERE draft_uuid IS NOT NULL")
        return [r["draft_uuid"] for r in cur.fetchall()]


def upsert_draft_outcome(
    conn: psycopg.Connection, *, draft_uuid: str, stage: str | None,
    status: str | None, accepted_on: date | None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO draft_outcomes (draft_uuid, stage, status, accepted_on, fetched_at)
            VALUES (%s, %s, %s, %s, now())
            ON CONFLICT (draft_uuid) DO UPDATE SET
              stage=EXCLUDED.stage, status=EXCLUDED.status,
              accepted_on=EXCLUDED.accepted_on, fetched_at=now()
            """,
            (draft_uuid, stage, status, accepted_on),
        )


def member_name_to_id(conn: psycopg.Connection) -> dict[str, int]:
    """Map every member's full name to its surrogate id (for verbatim speaker matching)."""
    with conn.cursor() as cur:
        cur.execute("SELECT id, full_name FROM members")
        return {r["full_name"]: r["id"] for r in cur.fetchall()}


def upsert_speeches(conn: psycopg.Connection, rows: list[tuple]) -> None:
    """Bulk-upsert speech rows in one batched round-trip (executemany), not one per row.

    Each tuple: (member_id, speech_key, speaker_uuid, spoken_at, sitting_date, sitting_type,
    agenda_title, steno_link, text, lemmas) -- the final `lemmas` string is turned into the
    `search` tsvector inline (the lemmas column itself was dropped in 0014). Remote per-row
    inserts are latency-bound, so callers chunk and batch here (see cli._ingest_verbatims).
    """
    if not rows:
        return
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO member_speeches
              (member_id, speech_key, speaker_uuid, spoken_at, sitting_date, sitting_type,
               agenda_title, steno_link, text, search)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, to_tsvector('simple', %s))
            ON CONFLICT (speech_key) DO UPDATE SET
              member_id=EXCLUDED.member_id, speaker_uuid=EXCLUDED.speaker_uuid,
              spoken_at=EXCLUDED.spoken_at, sitting_date=EXCLUDED.sitting_date,
              sitting_type=EXCLUDED.sitting_type, agenda_title=EXCLUDED.agenda_title,
              steno_link=EXCLUDED.steno_link, text=EXCLUDED.text, search=EXCLUDED.search
            """,
            rows,
        )


def update_speech_meta(conn: psycopg.Connection, rows: list[tuple]) -> None:
    """Batch-update metadata (sitting_type, agenda_title, steno_link) by speech_key, without
    touching text/lemmas -- so existing rows can be refreshed without re-lemmatising.
    Each tuple: (sitting_type, agenda_title, steno_link, speech_key)."""
    if not rows:
        return
    with conn.cursor() as cur:
        cur.executemany(
            "UPDATE member_speeches SET sitting_type=%s, agenda_title=%s, steno_link=%s "
            "WHERE speech_key=%s",
            rows,
        )


def member_name_dob_to_id(conn: psycopg.Connection) -> dict[tuple[str, str], int]:
    """Map (normalized full name, ISO DOB) -> member id, for name+DOB external matching.

    Uses election_parse.normalize_name (NFC + casefold + collapsed whitespace) so ALL-CAPS
    election names match title-case member names.
    """
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, full_name, date_of_birth FROM members WHERE date_of_birth IS NOT NULL"
        )
        return {
            (normalize_name(r["full_name"]), r["date_of_birth"].isoformat()): r["id"]
            for r in cur.fetchall()
        }


def member_unique_dob_to_id(conn: psycopg.Connection) -> dict[str, int]:
    """Map ISO DOB -> member id, but ONLY for DOBs held by exactly one member.

    A safe fallback for election rows whose name differs from ours (nickname / surname
    change): a globally-unique DOB can't false-match. Ambiguous DOBs (shared birthdays) are
    omitted, so they never produce a wrong link.
    """
    with conn.cursor() as cur:
        cur.execute(
            "SELECT date_of_birth FROM members WHERE date_of_birth IS NOT NULL "
            "GROUP BY date_of_birth HAVING count(*) = 1"
        )
        unique = {r["date_of_birth"].isoformat() for r in cur.fetchall()}
        cur.execute(
            "SELECT id, date_of_birth FROM members WHERE date_of_birth IS NOT NULL"
        )
        return {
            r["date_of_birth"].isoformat(): r["id"]
            for r in cur.fetchall()
            if r["date_of_birth"].isoformat() in unique
        }


def upsert_election_result(
    conn: psycopg.Connection, *, member_id: int, election_code: str, party_code: str | None,
    district_number: int | None, personal_votes: int, quota: str | None,
    elected: bool, mandate_type: str | None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO member_election_results
              (member_id, election_code, party_code, district_number,
               personal_votes, quota, elected, mandate_type)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (member_id, election_code) DO UPDATE SET
              party_code=EXCLUDED.party_code, district_number=EXCLUDED.district_number,
              personal_votes=EXCLUDED.personal_votes, quota=EXCLUDED.quota,
              elected=EXCLUDED.elected, mandate_type=EXCLUDED.mandate_type
            """,
            (member_id, election_code, party_code, district_number,
             personal_votes, quota, elected, mandate_type),
        )


def upsert_election_candidate(
    conn: psycopg.Connection, *, election_code: str, app_id: int, forename: str, surname: str,
    party_code: str | None, district_number: int | None, personal_votes: int,
    mandate_type: str | None,
) -> None:
    """An elected candidate who never took a seat (no members row). See 0017_election_candidates."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO election_candidates
              (election_code, app_id, forename, surname, party_code, district_number,
               personal_votes, mandate_type)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (election_code, app_id) DO UPDATE SET
              forename=EXCLUDED.forename, surname=EXCLUDED.surname, party_code=EXCLUDED.party_code,
              district_number=EXCLUDED.district_number, personal_votes=EXCLUDED.personal_votes,
              mandate_type=EXCLUDED.mandate_type
            """,
            (election_code, app_id, forename, surname, party_code, district_number,
             personal_votes, mandate_type),
        )


def member_norm_name_to_id(conn: psycopg.Connection) -> dict[str, int]:
    """Map normalized full name -> member id, ONLY for names unique among members.

    The kuluhüvitised CSV has no DOB, so name is the only key. Names shared by two members are
    omitted (we can't tell which is meant) rather than mis-mapped. Normalization mirrors
    election_parse.normalize_name (NFC + casefold + collapsed whitespace).
    """
    counts: dict[str, int] = {}
    by_name: dict[str, int] = {}
    with conn.cursor() as cur:
        cur.execute("SELECT id, full_name FROM members")
        for r in cur.fetchall():
            n = normalize_name(r["full_name"])
            counts[n] = counts.get(n, 0) + 1
            by_name[n] = r["id"]
    return {n: mid for n, mid in by_name.items() if counts[n] == 1}


def upsert_member_expense(
    conn: psycopg.Connection, *, member_id: int, year: int, limit_eur, spent_eur,
    breakdown: dict,
) -> None:
    from psycopg.types.json import Json

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO member_expenses (member_id, year, limit_eur, spent_eur, breakdown)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (member_id, year) DO UPDATE SET
              limit_eur=EXCLUDED.limit_eur, spent_eur=EXCLUDED.spent_eur,
              breakdown=EXCLUDED.breakdown
            """,
            (member_id, year, limit_eur, spent_eur, Json(breakdown)),
        )


def member_id_by_riigikogu_id(conn: psycopg.Connection, riigikogu_id: str) -> int | None:
    """Resolve a member's surrogate id from their API uuid, or None if not in the DB."""
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM members WHERE riigikogu_id = %s", (riigikogu_id,))
        row = cur.fetchone()
        return row["id"] if row else None


def upsert_speech_stats(
    conn: psycopg.Connection, *, member_id: int, speeches: int, questions: int,
    procedural: int, total: int, period_start: date | None, period_end: date | None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO member_speech_stats
              (member_id, speeches, questions, procedural, total,
               period_start, period_end, fetched_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, now())
            ON CONFLICT (member_id) DO UPDATE SET
              speeches=EXCLUDED.speeches, questions=EXCLUDED.questions,
              procedural=EXCLUDED.procedural, total=EXCLUDED.total,
              period_start=EXCLUDED.period_start, period_end=EXCLUDED.period_end,
              fetched_at=now()
            """,
            (member_id, speeches, questions, procedural, total, period_start, period_end),
        )


def _lemma_counts(conn: psycopg.Connection, scope_kind: str) -> dict[int, dict[str, int]]:
    """Per-scope lemma->count from member_speeches, for signature-word TF-IDF.

    The raw `lemmas` text column was dropped in 0014; lemma frequencies are read from the
    `search` tsvector, whose 'simple'-config lexemes are the lemmas and whose position count
    (array_length(positions,1)) is the occurrence count. scope_kind='member' groups by member;
    'party' groups by each member's current party.

    ponytail: tsvector caps stored positions per lexeme (~256), so counts for extremely frequent
    lemmas are approximate -- fine for ranking distinctive words.
    """
    if scope_kind == "member":
        sql = """
            SELECT ms.member_id AS sid, u.lexeme AS lemma,
                   sum(coalesce(array_length(u.positions, 1), 1))::int AS n
              FROM member_speeches ms,
                   unnest(ms.search) AS u(lexeme, positions, weights)
             GROUP BY ms.member_id, u.lexeme
        """
    elif scope_kind == "party":
        sql = """
            SELECT mcp.party_id AS sid, u.lexeme AS lemma,
                   sum(coalesce(array_length(u.positions, 1), 1))::int AS n
              FROM member_speeches ms
              JOIN member_current_party mcp ON mcp.member_id = ms.member_id,
                   unnest(ms.search) AS u(lexeme, positions, weights)
             WHERE mcp.party_id IS NOT NULL
             GROUP BY mcp.party_id, u.lexeme
        """
    else:
        raise ValueError(f"unknown scope_kind: {scope_kind}")
    docs: dict[int, dict[str, int]] = {}
    with conn.cursor() as cur:
        cur.execute(sql)
        for r in cur.fetchall():
            docs.setdefault(r["sid"], {})[r["lemma"]] = r["n"]
    return docs


def replace_signature_terms(
    conn: psycopg.Connection, rows: list[tuple[str, int, str, float, int]]
) -> None:
    """Full-replace signature_terms. rows: (scope_kind, scope_id, lemma, score, rank)."""
    with conn.cursor() as cur:
        cur.execute("TRUNCATE signature_terms")
        cur.executemany(
            "INSERT INTO signature_terms (scope_kind, scope_id, lemma, score, rank)"
            " VALUES (%s, %s, %s, %s, %s)",
            rows,
        )


def _member_name_lemmas(conn: psycopg.Connection) -> frozenset[str]:
    """Lowercased name tokens of every known member (whole hyphenated names + their parts).

    Signature words that are colleagues' names (a speaker addressing/quoting another member)
    say nothing about the speaker, so they are excluded from TF-IDF. ponytail: exact-match on
    name tokens; genitive lemmatiser leftovers stay in MANUAL_EXCLUDE, and surnames that are
    also common nouns (Tamm, Kokk, Rand...) get excluded as collateral -- acceptable.
    """
    with conn.cursor() as cur:
        cur.execute("SELECT full_name FROM members")
        names = [r["full_name"].lower() for r in cur.fetchall()]
    return frozenset(tok for n in names for tok in re.split(r"[\s-]+", n) + n.split() if tok)


def refresh_signatures(conn: psycopg.Connection, top_n: int = 25) -> int:
    """Recompute signature_terms for member + party scopes from member_speeches. Returns row count.

    Safe to call when signature_terms doesn't exist yet (pre-migration): it no-ops with a notice.
    """
    from parteidistsipliin_scraper.signature import compute_from_counts

    with conn.cursor() as cur:
        cur.execute("SELECT to_regclass('signature_terms') IS NOT NULL AS present")
        row = cur.fetchone()
        if not row or not row["present"]:
            return 0

    name_lemmas = _member_name_lemmas(conn)
    rows: list[tuple[str, int, str, float, int]] = []
    for kind in ("member", "party"):
        for sid, lemma, score, rank in compute_from_counts(
            _lemma_counts(conn, kind), top_n, exclude=name_lemmas
        ):
            rows.append((kind, sid, lemma, score, rank))
    replace_signature_terms(conn, rows)
    return len(rows)


def _replace_child(
    conn: psycopg.Connection, table: str, cols: str, member_id: int, rows: list[tuple]
) -> None:
    """DELETE a member's rows in a profile child table, then bulk-insert `rows`. Idempotent."""
    placeholders = ", ".join(["%s"] * (cols.count(",") + 1))
    with conn.cursor() as cur:
        cur.execute(f"DELETE FROM {table} WHERE member_id = %s", (member_id,))
        if rows:
            cur.executemany(
                f"INSERT INTO {table} (member_id, {cols}) VALUES (%s, {placeholders})",
                [(member_id, *r) for r in rows],
            )


def write_member_profile(
    conn: psycopg.Connection,
    member_id: int,
    p,
    *,
    profession_tag: str | None,
    hobbies: list[tuple[str, str]],     # (raw, hobby_tag)
    universities: list[str],
    coords: tuple[float, float] | None,
) -> None:
    """Upsert a member's profile row + replace its child rows (hobbies, universities, languages,
    honours, caucuses) from parsed ProfileData `p`."""
    lat, lon = (coords if coords else (None, None))
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO member_profiles
              (member_id, birthplace_town, birthplace_lat, birthplace_lon,
               children_count, family_status_raw, profession_tag, scraped_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, now())
            ON CONFLICT (member_id) DO UPDATE SET
              birthplace_town=EXCLUDED.birthplace_town,
              birthplace_lat=EXCLUDED.birthplace_lat, birthplace_lon=EXCLUDED.birthplace_lon,
              children_count=EXCLUDED.children_count, family_status_raw=EXCLUDED.family_status_raw,
              profession_tag=EXCLUDED.profession_tag, scraped_at=now()
            """,
            (member_id, p.birthplace_town, lat, lon, p.children_count,
             p.family_status_raw, profession_tag),
        )
    _replace_child(conn, "member_hobbies", "raw, hobby_tag", member_id, hobbies)
    _replace_child(
        conn, "member_universities", "university", member_id, [(u,) for u in universities]
    )
    caucuses = (
        [("friendship", g) for g in p.friendship_groups]
        + [("cause", g) for g in p.cause_groups]
    )
    _replace_child(conn, "member_caucuses", "kind, name", member_id, caucuses)
