import json
from pathlib import Path

from parteidistsipliin_scraper.api_models import PlenaryMember, Voting

FIX = Path(__file__).resolve().parents[1] / "fixtures" / "api"


def test_voting_parses_fixture():
    raw = json.loads((FIX / "voting_detail.json").read_text(encoding="utf-8"))
    v = Voting.model_validate(raw)
    assert v.uuid == "f00112a8-4bee-4535-9c9b-1e2d30e5b366"
    assert v.type.code == "AVALIK"
    assert v.description == "Lõpphääletus"
    assert v.startDateTime.year == 2025 and v.startDateTime.month == 6
    assert len(v.voters) == 4
    assert v.voters[0].decision.code == "POOLT"
    assert v.voters[0].faction.name == "Eesti Reformierakonna fraktsioon"
    assert v.voters[3].faction.name == "Fraktsiooni mittekuuluvad Riigikogu liikmed"


def test_plenary_members_parse_fixture():
    raw = json.loads((FIX / "plenary_members.json").read_text(encoding="utf-8"))
    members = [PlenaryMember.model_validate(m) for m in raw]
    assert len(members) == 2
    assert members[0].fullName == "Yoko Alender"
    assert members[0].photo.uuid == "photo-0001"
    assert members[0].factions[0].active is True
    assert members[1].factions[0].name == "Fraktsiooni mittekuuluvad Riigikogu liikmed"


def test_session_parses_fixture():
    from parteidistsipliin_scraper.api_models import Session
    raw = json.loads((FIX / "sessions.json").read_text(encoding="utf-8"))
    sessions = [Session.model_validate(s) for s in raw]
    assert len(sessions) == 3
    assert sessions[0].number == 5
    assert sessions[0].type.code == "KORRALINE"
    assert sessions[0].startDate.isoformat() == "2025-01-13"
    assert sessions[2].type.code == "ERAKORRALINE"


def test_voting_carries_sitting_and_draft():
    raw = json.loads((FIX / "voting_detail.json").read_text(encoding="utf-8"))
    v = Voting.model_validate(raw)
    assert v.sitting is not None and v.sitting.uuid.startswith("5111aaaa")
    assert v.relatedDraft is not None and v.relatedDraft.mark == 657


def test_member_enrichment_fields_parse():
    raw = json.loads((FIX / "plenary_members.json").read_text(encoding="utf-8"))
    m = PlenaryMember.model_validate(raw[0])
    assert m.gender == "FEMALE"
    assert m.dateOfBirth.isoformat() == "1976-05-04"
    assert m.parliamentSeniority == 2500
    assert m.plenaryMembership.startDate.isoformat() == "2023-04-10"
    assert m.committees[0].type.code == "ALALINE_KOMISJON"
    assert m.committees[0].membership.role.code == "ESIMEES"
    assert m.electoralDistrictHistory[0].electoralDistrict.code == "HARJU_JA_RAPLAMAA"
