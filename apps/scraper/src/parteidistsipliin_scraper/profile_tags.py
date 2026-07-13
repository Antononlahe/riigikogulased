"""Tagging for freeform CV fields.

- Universities are a small closed set matched by a committed alias dictionary (no LLM).
- Hobbies and pre-politics professions have no official taxonomy, so a one-time offline LLM pass
  (the `profiles-tag` command) maps each distinct hobby phrase and each member's career to a
  fixed tag, and commits the result as cache/profiles/profile_tags.json. `load_tag_map` reads
  that committed file; the writer joins raw -> tag through it, so rebuild/CI never call an LLM.
"""

from __future__ import annotations

import json
import re
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


# Any higher-education institution reads as one of these words; a gümnaasium / tehnikum /
# kutsekool / keskkool carries none of them, so it correctly yields no institution.
_HIGHER_ED = re.compile(
    r"ülikool|kõrgkool|akadeemia|konservatoorium|instituut|universi|kolledž|college"
    r"|\bEBS\b|Business School",
    re.IGNORECASE,
)
# "kolledž"/"college" is ambiguous -- some secondary schools are named that (Tallinna Inglise
# Kolledž, "endine 7. Keskkool"). A segment naming a keskkool/gümnaasium is a secondary school even
# if it also carries a higher-ed word, so it never counts as higher ed.
_SECONDARY = re.compile(r"keskkool|gümnaasium", re.IGNORECASE)


def _institution_name(segment: str) -> str:
    """Reduce an education segment to just the institution name by cutting at the first top-level
    comma or 4-digit year -- whichever comes first -- dropping the graduation year and field of
    study. Commas inside parentheses don't count, so a parenthesised location stays whole:
    'Rootsi Kaitseakadeemia (Försvarshögskolan, Stockholm) 1999' -> '...(Försvarshögskolan, Stockholm)',
    while 'Jyväskylä Ülikool, filosoofiadoktor 2010' -> 'Jyväskylä Ülikool'."""
    depth = 0
    for i, ch in enumerate(segment):
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth = max(0, depth - 1)
        elif depth == 0 and (ch == "," or segment[i : i + 4].isdigit()):
            return segment[:i].strip(" .,;")
    return segment.strip(" .,;")


def higher_ed_institutions(education_raw: str | None) -> list[str]:
    """Higher-education institutions named in an education string, deduped, first-seen order. The
    eight best-known Estonian universities are canonicalised (Soviet-era + short-form aliases merged)
    via UNIVERSITIES; any OTHER institution carrying a higher-ed keyword (private, foreign, military
    academies) is kept under its cleaned name rather than dropped. No higher-ed keyword -> empty,
    which is what marks a member as "no higher education"."""
    if not education_raw:
        return []
    out: list[str] = []
    for segment in education_raw.split(";"):
        if not _HIGHER_ED.search(segment) or _SECONDARY.search(segment):
            continue
        canonical = next(
            (c for c, aliases in UNIVERSITIES.items() if any(a in segment for a in aliases)),
            None,
        )
        name = canonical or _institution_name(segment)
        if name and name not in out:
            out.append(name)
    return out


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
