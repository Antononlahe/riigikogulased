from datetime import date

from parteidistsipliin_scraper.ariregister_models import (
    Candidate,
    Membership,
    PartyTerm,
    card_to_party_term,
    match_candidate,
    memberships_to_party_terms,
    name_to_party,
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


def test_registry_codes_for_all_six_seeded_parties():
    # Codes verified against live registry member_history pages (2026-06-15).
    assert registry_code_to_party("80053370") == ("KE", "Eesti Keskerakond")
    assert registry_code_to_party("80551335") == ("E200", "Erakond Eesti 200")
    assert registry_code_to_party("80052459") == ("SDE", "Sotsiaaldemokraatlik Erakond")
    assert registry_code_to_party("80243584") == ("I", "Erakond Isamaa")


def test_registry_code_unknown_but_known_name_maps_to_short():
    # An unseeded code but a recognised party display-name still resolves to the short.
    assert registry_code_to_party("99999999", "Sotsiaaldemokraatlik Erakond") == (
        "SDE",
        "Sotsiaaldemokraatlik Erakond",
    )


def test_name_to_party_handles_registry_name_variants():
    assert name_to_party("ISAMAA Erakond") == ("I", "Erakond Isamaa")
    assert name_to_party("Erakond Isamaa ja Res Publica Liit") == ("I", "Erakond Isamaa")
    assert name_to_party("EKRE - Eesti Konservatiivne Rahvaerakond") == (
        "EKRE",
        "Eesti Konservatiivne Rahvaerakond",
    )
    assert name_to_party("Mingi Tundmatu Erakond") is None


def test_card_to_party_term_builds_open_term_for_known_party():
    pt = card_to_party_term("Eesti Keskerakond")
    assert pt == PartyTerm("KE", "Eesti Keskerakond", None, None)


def test_card_to_party_term_none_for_unknown_party():
    # A clearly-fictional name -- avoid real minor parties (e.g. ERK), which get added to the
    # mapping over time and would silently turn this negative case into a false pass/fail.
    assert card_to_party_term("Väljamõeldud Erakond XYZ") is None
    assert card_to_party_term(None) is None


def test_match_candidate_returns_card_only_when_no_linked_match():
    # A member with a single stable membership has no history link (person_id None);
    # we still match them by name + DOB so the caller can use the card's current party.
    cands = [
        Candidate("Mart Helme", date(1949, 10, 31), "EKRE", "2000065684"),
        Candidate(
            "Martin Helme", date(1976, 4, 24), "EKRE - Eesti Konservatiivne Rahvaerakond", None
        ),
    ]
    m = match_candidate(cands, full_name="Martin Helme", date_of_birth=date(1976, 4, 24))
    assert m is not None and m.person_id is None and m.party_name.startswith("EKRE")
