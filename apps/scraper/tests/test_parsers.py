from pathlib import Path
from uuid import UUID

import pytest

from parteidistsipliin_scraper.parsers import parse_members, parse_vote_detail, parse_vote_list

FIXTURES = Path(__file__).parent.parent / "fixtures"


@pytest.mark.skipif(
    not (FIXTURES / "vote_list.html").exists(),
    reason="capture fixtures/vote_list.html from a live Riigikogu page first",
)
def test_parse_vote_list_returns_entries() -> None:
    html = (FIXTURES / "vote_list.html").read_text(encoding="utf-8")
    entries = parse_vote_list(html)
    assert entries, "expected at least one vote entry on the listing page"
    for e in entries:
        assert isinstance(e.riigikogu_uuid, UUID)
        assert e.title


@pytest.mark.skipif(
    not (FIXTURES / "vote_detail.html").exists(),
    reason="capture fixtures/vote_detail.html from a live vote page first",
)
def test_parse_vote_detail_has_ballots() -> None:
    html = (FIXTURES / "vote_detail.html").read_text(encoding="utf-8")
    detail = parse_vote_detail(
        html, riigikogu_uuid=UUID("4785afdf-60cd-428c-b521-a5370d6651bc")
    )
    assert detail.title
    assert detail.ballots
    assert (detail.yes_count + detail.no_count + detail.abstain_count) > 0


@pytest.mark.skipif(
    not (FIXTURES / "members.html").exists(),
    reason="capture fixtures/members.html from a live members page first",
)
def test_parse_members_returns_members() -> None:
    html = (FIXTURES / "members.html").read_text(encoding="utf-8")
    members = parse_members(html)
    assert len(members) > 50, "Riigikogu has 101 members; expected more than 50"
