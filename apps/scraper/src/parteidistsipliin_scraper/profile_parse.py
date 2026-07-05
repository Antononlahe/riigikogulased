"""Parse a Riigikogu member profile page (server-rendered HTML) into structured CV data.

The profile at /riigikogu/koosseis/riigikogu-liikmed/saadik/<uuid>/ carries, in a block of
labelled <p> paragraphs plus two link sections:

  <p>13.06.1979 Tallinn<br />Abielus, neli last</p>          -- birth date + place / family
  <p><strong>Haridus:</strong> ...schools...</p>
  <p><strong>Töökohad:</strong> ...career...</p>
  <p><strong>Huvialad:</strong> arhitektuur, muusika, ...</p>
  ... <a href=".../parlamendiruhm/<uuid>/...">Eesti-Soome parlamendirühm</a>, ...
  ... <a href=".../uhendused/uhendus/<uuid>/...">Ametiühingute toetusrühm</a>, ...

Group links are picked by href pattern (not heading traversal) so the site nav menu -- which
also links the words "Parlamendirühmad"/"Ühendused" -- never leaks in.

NOT parsed: bill counts. The page caps "Algatatud/Juhitud eelnõud" at 3 with a "Kõik ..." link,
so the workhorse count needs a separate crawl (deferred). Honours/languages are only sometimes
labelled; absence yields an empty list.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime

from bs4 import BeautifulSoup

# Estonian cardinal number words for children counts ("neli last" -> 4). 1..12 covers reality.
_NUM_WORDS = {
    "üks": 1, "kaks": 2, "kolm": 3, "neli": 4, "viis": 5, "kuus": 6,
    "seitse": 7, "kaheksa": 8, "üheksa": 9, "kümme": 10, "üksteist": 11, "kaksteist": 12,
}
_DATE_LINE = re.compile(r"^\s*(\d{2}\.\d{2}\.\d{4})\s+(\S.*)$")
# A cardinal number: word (longest-first so "üksteist" beats "üks") or digits.
_NUM_TOKEN = re.compile(
    r"\b(üksteist|kaksteist|üks|kaks|kolm|neli|viis|kuus|seitse|kaheksa|üheksa|kümme|\d+)\b",
    re.IGNORECASE,
)
# Standalone "last" (child), NOT "lapselast" (grandchild): the \b before 'last' can't fire inside
# the single token "lapselast" (preceding char 'e' is a word char).
_CHILD = re.compile(r"\blast\b", re.IGNORECASE)
# Fallback when children aren't phrased as "N last": count sons + daughters ("kaks tütart",
# "kolm poega ja tütar"). Stems cover the inflections (poeg/poega/pojad, tütar/tütart/tütred).
_KID_KIND = re.compile(
    r"(?:(üksteist|kaksteist|üks|kaks|kolm|neli|viis|kuus|seitse|kaheksa|üheksa|kümme|\d+)\s+)?"
    r"(poeg|poja|tütar|tütre)\w*",
    re.IGNORECASE,
)
_BR = re.compile(r"<br\s*/?>", re.IGNORECASE)


@dataclass
class ProfileData:
    birth_date: date | None = None
    birthplace_town: str | None = None
    children_count: int | None = None
    family_status_raw: str | None = None
    education_raw: str | None = None
    career_raw: str | None = None
    hobbies_raw: list[str] = field(default_factory=list)
    languages: list[str] = field(default_factory=list)
    honours_raw: list[str] = field(default_factory=list)
    friendship_groups: list[str] = field(default_factory=list)
    cause_groups: list[str] = field(default_factory=list)


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _split_list(value: str) -> list[str]:
    """Split a comma/semicolon list, trim, drop a trailing period, drop empties.

    Commas inside parentheses are NOT split points, so "sport (aerutamine, jooksmine)" stays one
    item instead of fragmenting into "sport (aerutamine" / "jooksmine)".
    """
    parts, buf, depth = [], [], 0
    for ch in value.rstrip(" ."):
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth = max(0, depth - 1)
        if ch in ";," and depth == 0:
            parts.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    parts.append("".join(buf))
    return [p for p in (_clean(x) for x in parts) if p]


def _word_to_int(word: str) -> int | None:
    word = word.lower().strip(".,")
    return int(word) if word.isdigit() else _NUM_WORDS.get(word)


def _children_from(status: str) -> int | None:
    # Primary: the number before the first standalone "last". Scan the whole prefix (not just the
    # adjacent token) so "neli täiskasvanud last" reads 4, and grandchildren ("... lapselast")
    # after the first "last" are ignored.
    m = _CHILD.search(status)
    if m:
        nums = _NUM_TOKEN.findall(status[: m.start()])
        return _word_to_int(nums[-1]) if nums else None
    # Fallback: sum sons + daughters when children aren't phrased with "last".
    total, found = 0, False
    for num, _stem in _KID_KIND.findall(status):
        found = True
        total += (_word_to_int(num) or 0) if num else 1
    return total if found else None


def parse_profile(html: str) -> ProfileData:
    soup = BeautifulSoup(html, "html.parser")
    data = ProfileData()

    # --- personal line + labelled paragraphs ---
    for p in soup.find_all("p"):
        strong = p.find("strong")
        if strong:
            label = _clean(strong.get_text()).rstrip(":").lower()
            # value = the paragraph text minus the leading label
            value = _clean(p.get_text(" ")).split(":", 1)
            value = _clean(value[1]) if len(value) == 2 else ""
            if label.startswith("haridus"):
                data.education_raw = value or None
            elif label.startswith("töökoh"):
                data.career_raw = value or None
            elif label.startswith("huvialad"):
                data.hobbies_raw = _split_list(value)
            elif label.startswith("teenetemär"):
                data.honours_raw = _split_list(value)
            elif label.startswith(("keelteoskus", "keeled", "keelte")):
                data.languages = _split_list(value)
            continue

        # Personal line: split on <br>; first line = "dd.mm.yyyy <birthplace>".
        if data.birth_date is None:
            lines = [_clean(BeautifulSoup(seg, "html.parser").get_text(" "))
                     for seg in _BR.split(p.decode_contents())]
            m = _DATE_LINE.match(lines[0]) if lines else None
            if m:
                data.birth_date = datetime.strptime(m.group(1), "%d.%m.%Y").date()
                data.birthplace_town = _clean(m.group(2)) or None
                if len(lines) > 1 and lines[1]:
                    data.family_status_raw = lines[1]
                    data.children_count = _children_from(lines[1])

    # --- group memberships, by href pattern (avoids the nav menu) ---
    for a in soup.find_all("a", href=True):
        href, text = a["href"], _clean(a.get_text(" "))
        if not text:
            continue
        if "/parlamendiruhmad/parlamendiruhm/" in href and text not in data.friendship_groups:
            data.friendship_groups.append(text)
        elif "/uhendused/uhendus/" in href and text not in data.cause_groups:
            data.cause_groups.append(text)

    return data
