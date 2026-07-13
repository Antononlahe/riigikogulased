from datetime import date
from pathlib import Path

import pytest

from parteidistsipliin_scraper.profile_parse import _children_from, parse_profile

FIX = Path(__file__).resolve().parents[1] / "fixtures" / "profiles"


@pytest.fixture(scope="module")
def profiles():
    return {name: parse_profile((FIX / f"{name}.html").read_text(encoding="utf-8"))
            for name in ("alender", "aab", "akkermann")}


def test_birth_and_place(profiles):
    assert profiles["alender"].birth_date == date(1979, 6, 13)
    assert profiles["alender"].birthplace_town == "Tallinn"
    assert profiles["aab"].birth_date == date(1960, 4, 9)
    assert profiles["aab"].birthplace_town == "Taagepera küla, Valgamaa"
    assert profiles["akkermann"].birthplace_town == "Kihnu"


def test_children_count_from_number_words(profiles):
    assert profiles["alender"].children_count == 4       # "neli last"
    assert profiles["aab"].children_count == 2            # "kaks last" -- NOT "viis lapselast"
    assert profiles["akkermann"].children_count == 3      # "kolm last"


def test_children_count_edge_phrasings():
    # Number not adjacent to "last" (adjective in between).
    assert _children_from("Lesk, peres neli täiskasvanud last ja seitse lapselast") == 4
    # Children as sons/daughters, no "last" token.
    assert _children_from("Abielus, kaks tütart") == 2
    assert _children_from("Abielus, kolm poega ja tütar") == 4
    # Singular "üks laps" (nom sg) -- 2+ uses "last", but 1 child uses "laps".
    assert _children_from("Vallaline, üks laps") == 1
    assert _children_from("Abielus, üks laps") == 1
    # Singular child + grandchildren: count the child, ignore "lapselast"/"lapselaps".
    assert _children_from("Abielus, üks laps ja kaks lapselast") == 1
    assert _children_from("Abielus, üks laps ja lapselaps") == 1
    # Grandchildren must not leak into the count.
    assert _children_from("Abielus, kaheksa last, kuus lapselast") == 8
    assert _children_from("Lesk, viis last, üheksa lapselast") == 5
    # No children signal.
    assert _children_from("Abielus") is None
    assert _children_from("Vallaline") is None


def test_family_status_raw(profiles):
    assert "Abielus" in profiles["alender"].family_status_raw
    assert "Lahutatud" in profiles["akkermann"].family_status_raw


def test_hobbies(profiles):
    assert profiles["alender"].hobbies_raw == [
        "arhitektuur", "muusika", "reisimine", "tervislik eluviis",
    ]
    assert "sport" in profiles["aab"].hobbies_raw
    assert "kalapüük" in profiles["akkermann"].hobbies_raw


def test_education_and_career_raw(profiles):
    assert "Eesti Kunstiakadeemia" in profiles["alender"].education_raw
    assert "Tartu Ülikool" in profiles["akkermann"].education_raw
    assert "Kultorg" in profiles["alender"].career_raw


def test_friendship_and_cause_groups(profiles):
    aab = profiles["aab"]
    assert "Eesti-Soome parlamendirühm" in aab.friendship_groups
    assert "Eesti-Leedu parlamendirühm" in aab.friendship_groups
    assert "Ametiühingute toetusrühm" in aab.cause_groups
    # nav-menu links (/riigikogu/parlamendiruhmad/) must NOT leak in as a group
    assert all("parlamendirühm" in g for g in aab.friendship_groups)


def test_no_crash_on_missing_optional_fields(profiles):
    # honours / languages are inconsistently published; absence -> empty list, never an error.
    for p in profiles.values():
        assert isinstance(p.honours_raw, list)
        assert isinstance(p.languages, list)


# --- tagging / lookup layer (uses the committed profile_tags.json + towns) ---
from parteidistsipliin_scraper.profile_tags import canonical_university, load_tag_map  # noqa: E402
from parteidistsipliin_scraper.towns import coords_for  # noqa: E402

ALENDER = "90074aa2-4938-41a9-8275-3a6efa1cee31"
AAB = "6b45cfb5-8a17-481c-b674-80fc00c6cf5d"
AKKERMANN = "7655e8d3-b658-49f0-8e09-f6cbc4a2c714"


def test_profession_tags_committed():
    prof = load_tag_map()["profession"]
    assert prof[ALENDER] == "kultuur ja kunst"
    assert prof[AAB] == "õpetaja"
    assert prof[AKKERMANN] == "ettevõtja"


def test_hobby_tag_map_buckets_phrases():
    hob = load_tag_map()["hobby"]
    assert hob["arhitektuur"] == "kunst"
    assert hob["sport"] == "sport"
    assert hob["kalapüük"] == "jaht ja kalapüük"


def test_canonical_university(profiles):
    assert "Eesti Kunstiakadeemia" in canonical_university(profiles["alender"].education_raw)
    assert "Tallinna Ülikool" in canonical_university(profiles["aab"].education_raw)
    assert "Tartu Ülikool" in canonical_university(profiles["akkermann"].education_raw)


def test_coords_town_and_county_fallback():
    assert coords_for("Tallinn") is not None
    assert coords_for("Taagepera küla, Valgamaa") is not None   # village -> county seat
    assert coords_for("Constanţa, Rumeenia") is None             # foreign -> no pin
