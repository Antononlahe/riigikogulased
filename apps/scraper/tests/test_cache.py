from datetime import datetime
from pathlib import Path
from uuid import UUID

from parteidistsipliin_scraper.cache import VoteCache
from parteidistsipliin_scraper.models import Ballot, VoteDetail


def _detail(uuid: str, when: datetime) -> VoteDetail:
    return VoteDetail(
        riigikogu_uuid=UUID(uuid),
        voted_at=when,
        title="Lõpphääletus",
        vote_type_slug="lopphaaletus",
        yes_count=2,
        no_count=1,
        abstain_count=0,
        absent_count=1,
        ballots=[
            Ballot(
                member_riigikogu_id="11111111-1111-1111-1111-111111111111",
                member_full_name="Yoko Alender",
                party_short_name="Eesti Reformierakonna fraktsioon",
                choice="yes",
            ),
            Ballot(
                member_riigikogu_id="22222222-2222-2222-2222-222222222222",
                member_full_name="Jaak Aab",
                party_short_name=None,  # non-attached
                choice="no",
            ),
        ],
    )


def test_cache_roundtrip(tmp_path: Path) -> None:
    cache = VoteCache(tmp_path)
    cache.append(_detail("aaaaaaaa-0000-0000-0000-000000000001", datetime(2025, 6, 17, 10, 0)))
    cache.append(_detail("aaaaaaaa-0000-0000-0000-000000000002", datetime(2025, 6, 16, 10, 0)))

    # Re-open from disk to prove persistence (not in-memory state).
    reloaded = VoteCache(tmp_path)
    details = reloaded.read_all()

    assert len(details) == 2
    # read_all returns chronological order regardless of write order.
    assert [d.voted_at for d in details] == [
        datetime(2025, 6, 16, 10, 0),
        datetime(2025, 6, 17, 10, 0),
    ]

    d = details[1]
    assert str(d.riigikogu_uuid) == "aaaaaaaa-0000-0000-0000-000000000001"
    assert d.title == "Lõpphääletus"
    assert d.vote_type_slug == "lopphaaletus"
    assert (d.yes_count, d.no_count, d.abstain_count, d.absent_count) == (2, 1, 0, 1)
    assert d.ballots[0].member_full_name == "Yoko Alender"
    assert d.ballots[0].party_short_name == "Eesti Reformierakonna fraktsioon"
    assert d.ballots[0].choice == "yes"
    # Non-attached faction round-trips as None.
    assert d.ballots[1].party_short_name is None


def test_cache_dedupes(tmp_path: Path) -> None:
    cache = VoteCache(tmp_path)
    d = _detail("aaaaaaaa-0000-0000-0000-000000000003", datetime(2025, 6, 18, 10, 0))
    cache.append(d)
    assert cache.has(d.riigikogu_uuid)
    cache.append(d)  # second append is a no-op
    assert len(VoteCache(tmp_path).read_all()) == 1
