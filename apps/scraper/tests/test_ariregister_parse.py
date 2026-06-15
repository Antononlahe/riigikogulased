from datetime import date
from pathlib import Path

from parteidistsipliin_scraper.ariregister_parse import (
    parse_member_history,
    parse_search_results,
)

FIX = Path(__file__).resolve().parents[1] / "fixtures" / "ariregister"


def _read(name: str) -> str:
    return (FIX / name).read_text(encoding="utf-8")


def test_parse_search_finds_laneman_with_id_and_dob():
    cands = parse_search_results(_read("search_laneman.html"))
    laneman = next(c for c in cands if c.person_id == "9000034247")
    assert laneman.full_name == "Alar Laneman"
    assert laneman.date_of_birth == date(1962, 5, 6)
    assert laneman.party_name and "Reformierakond" in laneman.party_name


def test_parse_search_collision_returns_multiple():
    cands = parse_search_results(_read("search_collision.html"))
    assert len(cands) >= 2


def test_parse_history_laneman_two_memberships_dated():
    rows = parse_member_history(_read("history_laneman.html"))
    re_row = next(m for m in rows if "Reformierakond" in m.party_name)
    assert re_row.started_on == date(2024, 7, 12)
    assert re_row.ended_on is None
    ekre = next(m for m in rows if "Konservatiivne" in m.party_name)
    assert ekre.ended_on == date(2024, 6, 14)
    assert ekre.registry_code == "80040344"


def test_parse_history_all_ended_has_no_current():
    rows = parse_member_history(_read("history_grunthal.html"))
    assert len(rows) >= 1 and all(m.ended_on is not None for m in rows)
    assert any(m.registry_code == "80040344" for m in rows)
