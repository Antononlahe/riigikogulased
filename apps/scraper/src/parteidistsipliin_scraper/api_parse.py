"""Pure helpers turning API field values into our domain values."""

from __future__ import annotations

import re

from parteidistsipliin_scraper.models import Choice

# ascii-fold for the Estonian letters that appear in vote descriptions.
_SLUG_FOLD = str.maketrans(
    {
        "õ": "o", "ä": "a", "ö": "o", "ü": "u", "š": "s", "ž": "z",
        "Õ": "o", "Ä": "a", "Ö": "o", "Ü": "u", "Š": "s", "Ž": "z",
    }
)


def vote_type_slug(description: str) -> str:
    """Normalize a voting's `description` into the stable `vote_type_slug`.

    Relocated verbatim from the v0.1 HTML `title_to_slug`. The two procedural titles
    must keep their seeded slugs (see `procedural_vote_types`):
        "Kohaloleku kontroll"    -> "kohalolekukontroll"
        "Päevakorra kinnitamine" -> "paevakorra-kinnitamine"
    Other descriptions get a generic slug: lowercase, ascii-folded, non-alphanumerics
    collapsed to single hyphens.
    """
    normalized = description.strip().translate(_SLUG_FOLD).lower()
    if normalized == "kohaloleku kontroll":
        return "kohalolekukontroll"
    return re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")


# API decision code -> internal ballots.choice domain. Mirrors the v0.1 CHOICE_MAP.
# "Ei hääletanud" (present, did not register) stays distinct from "Puudub" (absent).
# KOHAL (present in a presence check) is absent here on purpose: those ballots are
# dropped, matching v0.1, and presence checks are procedural (excluded from scoring).
_DECISION_TO_CHOICE: dict[str, Choice] = {
    "POOLT": "yes",
    "VASTU": "no",
    "ERAPOOLETU": "abstain",
    "EI_HAALETANUD": "neutral",
    "PUUDUB": "absent",
}


def decision_to_choice(code: str) -> Choice | None:
    """Map an API `decision.code` to a ballots.choice, or None to drop the ballot."""
    return _DECISION_TO_CHOICE.get(code)
