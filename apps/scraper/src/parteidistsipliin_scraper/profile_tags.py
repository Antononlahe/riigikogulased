"""Tagging for freeform CV fields.

- Universities are a small closed set matched by a committed alias dictionary (no LLM).
- Hobbies and pre-politics professions have no official taxonomy, so a one-time offline LLM pass
  (the `profiles-tag` command) maps each distinct hobby phrase to a fixed tag and each member's
  career to a LIST of profession tags (dominant role first; a member usually has several), and
  commits the result as cache/profiles/profile_tags.json. `load_tag_map` reads that committed
  file; the writer joins raw -> tag through it, so rebuild/CI never call an LLM.
"""

from __future__ import annotations

import json
from pathlib import Path

from parteidistsipliin_scraper.profile_cache import CACHE_DIR

TAG_MAP_PATH = CACHE_DIR / "profile_tags.json"

# --- universities (closed set, alias -> canonical). Aliases include Soviet-era + short forms. ---
UNIVERSITIES: dict[str, tuple[str, ...]] = {
    "Tartu Ülikool": ("Tartu Ülikool", "Tartu Riiklik Ülikool", "Tartu Ãœlikool"),
    "Tallinna Ülikool": (
        "Tallinna Ülikool", "Tallinna Pedagoogikaülikool", "Tallinna Pedagoogiline Instituut",
    ),
    "Tallinna Tehnikaülikool": (
        "Tallinna Tehnikaülikool", "Tallinna Polütehniline Instituut", "TalTech",
    ),
    "Eesti Maaülikool": (
        "Eesti Maaülikool", "Eesti Põllumajanduse Akadeemia", "Eesti Põllumajandusülikool",
    ),
    "Eesti Kunstiakadeemia": ("Eesti Kunstiakadeemia", "Eesti Riiklik Kunstiinstituut"),
    "Eesti Muusika- ja Teatriakadeemia": (
        "Eesti Muusika- ja Teatriakadeemia", "Tallinna Riiklik Konservatoorium",
        "Tallinna Konservatoorium",
    ),
    "Estonian Business School": ("Estonian Business School", "EBS"),
    "Sisekaitseakadeemia": ("Sisekaitseakadeemia",),
}

# Allowed tag sets for the LLM pass (committed; the LLM only assigns phrases to these).
HOBBY_TAGS = (
    "sport", "muusika", "kirjandus", "kunst", "ajalugu", "loodus", "jaht ja kalapüük",
    "reisimine", "aiandus", "tehnika", "toit ja kokandus", "film ja teater", "usk",
    "pere ja kodu", "poliitika ja ühiskond", "tervis", "Muu",
)
PROFESSION_TAGS = (
    "jurist", "majandus ja rahandus", "ettevõtja", "õpetaja", "insener", "arst ja tervishoid",
    "ajakirjanik", "põllumajandus", "ametnik", "sõjaväe ja politsei", "kultuur ja kunst",
    "teadlane", "IT", "sportlane", "Muu",
)


def canonical_university(education_raw: str | None) -> list[str]:
    """Canonical Estonian universities named in an education string (deduped, in palette order)."""
    if not education_raw:
        return []
    found: list[str] = []
    for canonical, aliases in UNIVERSITIES.items():
        if any(alias in education_raw for alias in aliases) and canonical not in found:
            found.append(canonical)
    return found


def load_tag_map() -> dict:
    """Read the committed tag map, or an empty scaffold if it doesn't exist yet."""
    if TAG_MAP_PATH.exists():
        return json.loads(TAG_MAP_PATH.read_text(encoding="utf-8"))
    return {"hobby": {}, "profession": {}}


def save_tag_map(tag_map: dict) -> None:
    TAG_MAP_PATH.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(tag_map, ensure_ascii=False, indent=2, sort_keys=True)
    TAG_MAP_PATH.write_text(text, encoding="utf-8")


def distinct_hobby_phrases(cache_dir: Path | None = None) -> list[str]:
    """All distinct hobby phrases across cached profiles, for the LLM tag pass."""
    from parteidistsipliin_scraper.profile_cache import ProfileCache
    from parteidistsipliin_scraper.profile_parse import parse_profile

    seen: set[str] = set()
    for html in ProfileCache(cache_dir).read_all().values():
        seen.update(parse_profile(html).hobbies_raw)
    return sorted(seen)
