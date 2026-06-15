from pathlib import Path

from parteidistsipliin_scraper.api_cache import ApiVoteCache


def _raw(uuid: str, start: str) -> dict:
    return {
        "uuid": uuid,
        "type": {"code": "AVALIK", "value": "Avalik"},
        "description": "Lõpphääletus",
        "startDateTime": start,
        "inFavor": 1, "against": 0, "abstained": 0, "absent": 0,
        "voters": [
            {
                "uuid": "m-1",
                "fullName": "A",
                "faction": {"uuid": "re", "name": "Eesti Reformierakonna fraktsioon"},
                "decision": {"code": "POOLT", "value": "poolt"},
            }
        ],
    }


def test_append_dedupe_and_chronological_read(tmp_path: Path):
    cache = ApiVoteCache(tmp_path)
    cache.append_voting(_raw("u-2", "2025-06-17T10:00:00"))
    cache.append_voting(_raw("u-1", "2025-06-16T10:00:00"))
    cache.append_voting(_raw("u-2", "2025-06-17T10:00:00"))  # duplicate, ignored

    reloaded = ApiVoteCache(tmp_path)  # prove persistence from disk
    assert reloaded.has("u-2")
    votings = reloaded.read_votings()
    assert [v.uuid for v in votings] == ["u-1", "u-2"]  # chronological
    assert votings[0].voters[0].decision.code == "POOLT"


def test_write_members_roundtrip(tmp_path: Path):
    cache = ApiVoteCache(tmp_path)
    cache.write_members([{"uuid": "m-1", "fullName": "A", "factions": []}])
    members = ApiVoteCache(tmp_path).read_members()
    assert len(members) == 1 and members[0].fullName == "A"


def test_sessions_roundtrip(tmp_path: Path):
    cache = ApiVoteCache(tmp_path)
    cache.write_sessions([
        {"membership": 15, "number": 5, "type": {"code": "KORRALINE", "value": "Korraline"},
         "startDate": "2025-01-13", "endDate": "2025-06-19"},
    ])
    sessions = ApiVoteCache(tmp_path).read_sessions()
    assert len(sessions) == 1
    assert sessions[0].number == 5
    assert sessions[0].startDate.isoformat() == "2025-01-13"


def test_members_extra_roundtrip(tmp_path):
    cache = ApiVoteCache(directory=tmp_path)
    assert cache.read_members_extra() == []
    raw = [{"uuid": "u1", "fullName": "Riina Solman", "dateOfBirth": "1972-06-23"}]
    cache.write_members_extra(raw)
    out = cache.read_members_extra()
    assert len(out) == 1 and out[0].uuid == "u1" and out[0].fullName == "Riina Solman"
