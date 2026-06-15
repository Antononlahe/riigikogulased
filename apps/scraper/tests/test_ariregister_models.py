from datetime import date

from parteidistsipliin_scraper.ariregister_models import (
    Candidate,
    Membership,
    match_candidate,
    memberships_to_party_terms,
    registry_code_to_party,
)


def test_registry_code_maps_known_party():
    assert registry_code_to_party("80043147") == ("RE", "Eesti Reformierakond")


def test_registry_code_unknown_falls_back_to_name():
    assert registry_code_to_party("99999999", name="Uus Erakond") == (
        "Uus Erakond",
        "Uus Erakond",
    )


def test_match_candidate_by_name_and_dob():
    cands = [
        Candidate("Alar Laneman", date(1962, 5, 6), "Eesti Reformierakond", "9000034247"),
        Candidate("Alar Laneman", date(1980, 1, 1), "Muu", "9000000001"),
    ]
    m = match_candidate(cands, full_name="Alar Laneman", date_of_birth=date(1962, 5, 6))
    assert m is not None and m.person_id == "9000034247"


def test_match_candidate_no_dob_match_returns_none():
    cands = [Candidate("Alar Laneman", date(1999, 9, 9), "X", "1")]
    assert match_candidate(cands, full_name="Alar Laneman", date_of_birth=date(1962, 5, 6)) is None


def test_match_candidate_ignores_candidates_without_history_link():
    cands = [
        Candidate("Alar Laneman", date(1962, 5, 6), "Eesti Reformierakond", None),
        Candidate("Alar Laneman", date(1962, 5, 6), "Eesti Reformierakond", "9000034247"),
    ]
    m = match_candidate(cands, full_name="Alar Laneman", date_of_birth=date(1962, 5, 6))
    assert m is not None and m.person_id == "9000034247"


def test_match_candidate_no_dob_unique_name_matches():
    cands = [
        Candidate("Alar Laneman", date(1962, 5, 6), "RE", "9000034247"),
        Candidate("Mart Maasikas", date(1970, 1, 1), "X", "9000000002"),
    ]
    m = match_candidate(cands, full_name="Alar Laneman", date_of_birth=None)
    assert m is not None and m.person_id == "9000034247"


def test_match_candidate_no_dob_ambiguous_returns_none():
    cands = [
        Candidate("Jaan Tamm", date(1960, 1, 1), "X", "1"),
        Candidate("Jaan Tamm", date(1975, 2, 2), "Y", "2"),
    ]
    assert match_candidate(cands, full_name="Jaan Tamm", date_of_birth=None) is None


def test_membership_roundtrip_defaults_current():
    m = Membership("Eesti Reformierakond", "80043147", date(2024, 7, 12), None)
    assert m.party_name == "Eesti Reformierakond"
    assert m.registry_code == "80043147"
    assert m.started_on == date(2024, 7, 12)
    assert m.ended_on is None  # None = current membership


def test_memberships_to_party_terms_maps_codes_and_dates():
    ms = [
        Membership("Eesti Reformierakond", "80043147", date(2024, 7, 12), None),
        Membership(
            "Eesti Konservatiivne Rahvaerakond", "80040344", date(2019, 3, 27), date(2024, 6, 14)
        ),
        Membership("Tundmatu", None, date(2000, 1, 1), date(2001, 1, 1)),
    ]
    terms = memberships_to_party_terms(ms)
    triples = [(t.short, t.started_on, t.ended_on) for t in terms]
    assert ("RE", date(2024, 7, 12), None) in triples
    assert any(t.short == "Tundmatu" for t in terms)  # unknown code -> name fallback
