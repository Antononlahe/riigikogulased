from __future__ import annotations

import os
import re
from datetime import date

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


def upsert_party(conn: psycopg.Connection, short_name: str, name: str | None = None) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO parties (short_name, name)
            VALUES (%s, %s)
            ON CONFLICT (short_name) DO UPDATE
              SET name = COALESCE(EXCLUDED.name, parties.name)
            RETURNING id
            """,
            (short_name, name or short_name),
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


def set_member_party(
    conn: psycopg.Connection,
    member_id: int,
    party_id: int | None,
    started_on: date,
) -> None:
    """Close any open term that disagrees, then open a new one if needed."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, party_id FROM member_party_terms
            WHERE member_id = %s AND ended_on IS NULL
            """,
            (member_id,),
        )
        current = cur.fetchone()
        if current and current["party_id"] == party_id:
            return
        if current:
            cur.execute(
                "UPDATE member_party_terms SET ended_on = %s WHERE id = %s",
                (started_on, current["id"]),
            )
        cur.execute(
            """
            INSERT INTO member_party_terms (member_id, party_id, started_on)
            VALUES (%s, %s, %s)
            """,
            (member_id, party_id, started_on),
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
