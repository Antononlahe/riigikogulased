from parteidistsipliin_scraper.api_parse import decision_to_choice, vote_type_slug


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
