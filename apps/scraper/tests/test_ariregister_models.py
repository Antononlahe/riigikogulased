from datetime import date

from parteidistsipliin_scraper.ariregister_models import (
    Candidate,
    Membership,  # noqa: F401 -- imported to verify public surface of the module
    match_candidate,
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
