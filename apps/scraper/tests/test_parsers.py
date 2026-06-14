from pathlib import Path
from uuid import UUID

import pytest

from parteidistsipliin_scraper.parsers import parse_members, parse_vote_detail, parse_vote_list
from parteidistsipliin_scraper.parsers.vote_list import title_to_slug

FIXTURES = Path(__file__).parent.parent / "fixtures"


# --- title -> slug helper (no fixture needed) --------------------------------


@pytest.mark.parametrize(
    ("title", "expected"),
    [
        ("Kohaloleku kontroll", "kohalolekukontroll"),
        ("Päevakorra kinnitamine", "paevakorra-kinnitamine"),
        ("Lõpphääletus", "lopphaaletus"),
        ("II lugemise katkestamine", "ii-lugemise-katkestamine"),
        ("1. muudatusettepanek", "1-muudatusettepanek"),
        ("34. muudatusettepanek", "34-muudatusettepanek"),
        ("Tagasi lükkamine", "tagasi-lukkamine"),
    ],
)
def test_title_to_slug(title: str, expected: str) -> None:
    assert title_to_slug(title) == expected


# --- vote list ----------------------------------------------------------------


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
    not (FIXTURES / "vote_list.html").exists(),
    reason="capture fixtures/vote_list.html from a live Riigikogu page first",
)
def test_parse_vote_list_known_entry() -> None:
    html = (FIXTURES / "vote_list.html").read_text(encoding="utf-8")
    entries = parse_vote_list(html)
    by_uuid = {str(e.riigikogu_uuid): e for e in entries}

    # First presence check of the day.
    presence = by_uuid["cce73688-7b9d-43a5-894a-69127decd398"]
    assert presence.title == "Kohaloleku kontroll"
    assert presence.vote_type_slug == "kohalolekukontroll"
    # The sitting date comes from the day heading, the time from the row.
    assert presence.voted_at.date().isoformat() == "2025-06-11"

    # An amendment vote: slug derived from the title, NOT the URL (which is
    # always 'kohalolekukontroll').
    amendment = by_uuid["347dbb1a-e782-4d04-8734-10da3e5d8806"]
    assert amendment.title == "1. muudatusettepanek"
    assert amendment.vote_type_slug == "1-muudatusettepanek"

    # A final vote.
    final = by_uuid["4156f040-266b-41c2-a1dd-6d926fd6d7ea"]
    assert final.title == "Lõpphääletus"
    assert final.vote_type_slug == "lopphaaletus"


@pytest.mark.skipif(
    not (FIXTURES / "vote_list.html").exists(),
    reason="capture fixtures/vote_list.html from a live Riigikogu page first",
)
def test_parse_vote_list_count() -> None:
    html = (FIXTURES / "vote_list.html").read_text(encoding="utf-8")
    entries = parse_vote_list(html)
    # The captured day (11.06.2025) has 30 vote rows across two sittings. (The page
    # also has a "Viimane haaletus" quick-link in the sidebar pointing at a vote;
    # that anchor must NOT be counted as a row.)
    assert len(entries) == 30
    # The sidebar quick-link vote must be excluded.
    assert all(str(e.riigikogu_uuid) != "d10be1ea-16f6-4d2d-bbf8-ae4239330bdd" for e in entries)


# --- vote detail --------------------------------------------------------------


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
    not (FIXTURES / "vote_detail.html").exists(),
    reason="capture fixtures/vote_detail.html from a live vote page first",
)
def test_parse_vote_detail_tallies_and_ballots() -> None:
    html = (FIXTURES / "vote_detail.html").read_text(encoding="utf-8")
    detail = parse_vote_detail(
        html, riigikogu_uuid=UUID("4785afdf-60cd-428c-b521-a5370d6651bc")
    )

    # The "Koik" tab holds every member exactly once: 101 ballots, no duplicates
    # from the per-choice tabs.
    assert len(detail.ballots) == 101

    # Header tallies for this division.
    assert detail.yes_count == 16
    assert detail.no_count == 40
    assert detail.abstain_count == 0

    # Counts derived from the ballots themselves should agree with the header.
    counts = {"yes": 0, "no": 0, "abstain": 0, "absent": 0, "neutral": 0}
    for b in detail.ballots:
        counts[b.choice] += 1
    assert counts["yes"] == 16
    assert counts["no"] == 40
    assert counts["abstain"] == 0
    assert counts["neutral"] == 28  # "Ei haaletanud" - present but did not vote
    assert counts["absent"] == 17  # "Puudub"

    # A known member: Annely Akkermann voted Vastu (no), Reform faction.
    akkermann = next(
        b for b in detail.ballots if b.member_riigikogu_id == "7655e8d3-b658-49f0-8e09-f6cbc4a2c714"
    )
    assert akkermann.member_full_name == "Annely Akkermann"
    assert akkermann.choice == "no"
    assert akkermann.party_short_name == "Eesti Reformierakonna fraktsioon"

    # The detail title carries the date/time of the sitting.
    assert detail.voted_at.date().isoformat() == "2026-06-08"


# --- members ------------------------------------------------------------------


@pytest.mark.skipif(
    not (FIXTURES / "members.html").exists(),
    reason="capture fixtures/members.html from a live members page first",
)
def test_parse_members_returns_members() -> None:
    html = (FIXTURES / "members.html").read_text(encoding="utf-8")
    members = parse_members(html)
    assert len(members) > 50, "Riigikogu has 101 members; expected more than 50"


@pytest.mark.skipif(
    not (FIXTURES / "members.html").exists(),
    reason="capture fixtures/members.html from a live members page first",
)
def test_parse_members_exact() -> None:
    html = (FIXTURES / "members.html").read_text(encoding="utf-8")
    members = parse_members(html)
    assert len(members) == 101

    by_id = {m.riigikogu_id: m for m in members}
    # Natural key is the UUID segment, not the trailing name slug.
    aab = by_id["6b45cfb5-8a17-481c-b674-80fc00c6cf5d"]
    assert aab.full_name == "Jaak Aab"
    assert aab.party_short_name == "Fraktsiooni mittekuuluvad Riigikogu liikmed"

    akkermann = by_id["7655e8d3-b658-49f0-8e09-f6cbc4a2c714"]
    assert akkermann.full_name == "Annely Akkermann"
    assert akkermann.party_short_name == "Eesti Reformierakonna fraktsioon"
