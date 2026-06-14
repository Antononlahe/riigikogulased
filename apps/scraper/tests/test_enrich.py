import json
from datetime import date
from pathlib import Path

from parteidistsipliin_scraper.api_models import PlenaryMember, Session
from parteidistsipliin_scraper.enrich import (
    committee_terms,
    district_terms,
    map_sitting_to_session,
    member_fields,
    photo_download_url,
)

FIX = Path(__file__).resolve().parents[1] / "fixtures" / "api"


def _sessions():
    raw = json.loads((FIX / "sessions.json").read_text(encoding="utf-8"))
    return [Session.model_validate(s) for s in raw]


def test_sitting_inside_korraline_session():
    s = map_sitting_to_session(date(2025, 3, 1), _sessions())
    assert s is not None and s.number == 5


def test_overlap_prefers_narrower_extraordinary_session():
    # 2025-06-16 is inside KORRALINE #5 (..06-19) AND single-day ERAKORRALINE #108.
    s = map_sitting_to_session(date(2025, 6, 16), _sessions())
    assert s is not None and s.number == 108


def test_sitting_outside_all_sessions_is_none():
    assert map_sitting_to_session(date(2025, 7, 1), _sessions()) is None


def test_committee_terms_from_member():
    m = PlenaryMember.model_validate(
        json.loads((FIX / "plenary_members.json").read_text(encoding="utf-8"))[0]
    )
    terms = committee_terms(m)
    assert len(terms) == 1
    t = terms[0]
    assert t.name == "Keskkonnakomisjon"
    assert t.type_code == "ALALINE_KOMISJON"
    assert t.role_code == "ESIMEES"
    assert t.started_on == date(2023, 4, 10)
    assert t.ended_on is None


def test_district_terms_from_member():
    m = PlenaryMember.model_validate(
        json.loads((FIX / "plenary_members.json").read_text(encoding="utf-8"))[0]
    )
    dterms = district_terms(m)
    assert len(dterms) == 1
    assert dterms[0].code == "HARJU_JA_RAPLAMAA"
    assert dterms[0].name == "Harju- ja Raplamaa"
    assert dterms[0].term_number == 15


def test_member_fields_extraction():
    m = PlenaryMember.model_validate(
        json.loads((FIX / "plenary_members.json").read_text(encoding="utf-8"))[0]
    )
    f = member_fields(m)
    assert f.date_of_birth == date(1976, 5, 4)
    assert f.gender == "FEMALE"
    assert f.seniority_days == 2500
    assert f.mandate_started_on == date(2023, 4, 10)
    assert f.photo_uuid == "photo-0001"
    assert f.photo_url == photo_download_url("photo-0001")


def test_photo_download_url_is_absolute():
    assert photo_download_url("abc").startswith("https://api.riigikogu.ee/api/files/abc")
