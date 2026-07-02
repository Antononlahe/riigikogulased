from parteidistsipliin_scraper.api_parse import (
    decision_to_choice,
    required_majority,
    vote_type_slug,
)


def test_slug_preserves_procedural_titles():
    assert vote_type_slug("Kohaloleku kontroll") == "kohalolekukontroll"
    assert vote_type_slug("Päevakorra kinnitamine") == "paevakorra-kinnitamine"
    assert vote_type_slug("Lõpphääletus") == "lopphaaletus"


def test_decision_codes_map_to_choices():
    assert decision_to_choice("POOLT") == "yes"
    assert decision_to_choice("VASTU") == "no"
    assert decision_to_choice("ERAPOOLETU") == "abstain"
    assert decision_to_choice("EI_HAALETANUD") == "neutral"
    assert decision_to_choice("PUUDUB") == "absent"


def test_kohal_is_dropped():
    # Present-in-presence-check is not stored (matches v0.1; procedural, excluded).
    assert decision_to_choice("KOHAL") is None


def test_required_majority_members_cases():
    # umbusaldus arrives via relatedDocument, not relatedDraft
    assert required_majority(
        "lopphaaletus", None, "Umbusalduse avaldamine sotsiaalminister Karmen Jollerile"
    ) == "members"
    # RKKTS §154 lg 2: otsus making a proposal to the Government
    assert required_majority(
        "lopphaaletus",
        'Riigikogu otsus "Ettepaneku tegemine Vabariigi Valitsusele"',
        None,
    ) == "members"
    # PS §76 immunity waiver, regardless of titles
    assert required_majority("ettepaneku-haaletamine", None, None) == "members"
    # PS §104 law by title, also on post-veto re-adoption
    assert required_majority(
        "lopphaaletus", "Kriminaalmenetluse seadustiku muutmise seadus", None
    ) == "members"
    assert required_majority(
        "muutmata-kujul-uuesti-vastuvotmine", "Kohtute seaduse muutmise seadus", None
    ) == "members"


def test_required_majority_simple_cases():
    assert required_majority("lopphaaletus", "Jäätmeseaduse muutmise seadus", None) == "simple"
    # annual state budget is NOT the §104 framework riigieelarve seadus
    assert required_majority(
        "lopphaaletus", "2026. aasta riigieelarve seadus", None
    ) == "simple"
    # framework act IS §104
    assert required_majority(
        "lopphaaletus", "Riigieelarve seaduse muutmise seadus", None
    ) == "members"
    # non-final votes stay simple even on §104 bills
    assert required_majority(
        "tagasi-lukkamine", "Kohtute seaduse muutmise seadus", None
    ) == "simple"
    assert required_majority("1-muudatusettepanek", None, None) == "simple"
