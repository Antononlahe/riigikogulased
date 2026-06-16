from __future__ import annotations

import os
import re
from datetime import date
from pathlib import Path

import psycopg
from psycopg.rows import dict_row


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


def apply_migrations(conn: psycopg.Connection, migrations_dir: Path | None = None) -> list[str]:
    """Apply every unapplied NNNN_*.sql in order; record each in schema_migrations.

    Each migration file is responsible for its own BEGIN/COMMIT. We record each version
    in schema_migrations here so the tracking table is the source of truth regardless of
    whether a given file self-seeds it. The tracking table is created up front because the
    earliest migrations (0001) predate it -- without this, applying 0001 on a database that
    lacks the table would try to record into a relation only a later migration creates.
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
        conn.execute(path.read_text(encoding="utf-8"))
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
              photo_file_name = %s, photo_url = %s
            WHERE id = %s
            """,
            (
                f.date_of_birth, f.date_of_death, f.gender, f.email, f.phone,
                f.seniority_days, f.mandate_started_on, f.photo_uuid,
                f.photo_file_name, f.photo_url, member_id,
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
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE votes SET sitting_id = %s, draft_uuid = %s, "
            "draft_title = %s, draft_mark = %s WHERE id = %s",
            (sitting_id, draft_uuid, draft_title, draft_mark, vote_id),
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
