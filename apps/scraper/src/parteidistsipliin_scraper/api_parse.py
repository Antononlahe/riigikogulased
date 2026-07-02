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


# --- required majority ------------------------------------------------------------
# The API does not expose the passage rule, so we derive it. Most votings pass by
# poolthäälteenamus (yes > no). These need koosseisu häälteenamus (>= 51 yes of 101):
#   - umbusaldusavaldus, no-confidence (PS §97) — voting carries only relatedDocument
#   - Riigikogu otsus making a proposal to the Government (RKKTS §154 lg 2)
#   - consent to waive an MP's immunity (PS §76) — description "Ettepaneku hääletamine"
#   - final vote on a PS §104 constitutional-class law, matched by title below
# ponytail: 2/3 rules (constitution amendment itself) are not modeled — none occur in
# the 15th Riigikogu voting data; add if one ever appears.
_P104_PATTERNS = [
    r"\bkodakondsuse seadus",
    r"\briigikogu valimise seadus",
    r"\bvabariigi presidendi valimise seadus",
    r"\bkohaliku omavalitsuse volikogu valimise seadus",
    r"\brahvahääletuse seadus",
    r"\briigikogu kodu- ja töökorra seadus",
    r"\briigikogu liikme staatuse seadus",
    r"\bvabariigi valitsuse seadus",
    r"kohtulikule vastutusele võtmise seadus",
    r"\bvähemusrahvuse kultuurautonoomia seadus",
    r"\beesti panga seadus",
    r"\briigikontrolli seadus",
    r"\bõiguskantsleri seadus",
    r"\bkohtute seadus",
    r"\bkriminaalmenetluse seadustik",
    r"\btsiviilkohtumenetluse seadustik",
    r"\bhalduskohtumenetluse seadustik",
    r"\berakorralise seisukorra seadus",
    r"\briigikaitseseadus",
]

_FINAL_VOTE_SLUGS = {"lopphaaletus", "muutmata-kujul-uuesti-vastuvotmine"}


def required_majority(
    slug: str, draft_title: str | None, document_title: str | None
) -> str:
    """'members' (koosseisu häälteenamus, >= 51 yes) or 'simple' (yes > no)."""
    if slug == "ettepaneku-haaletamine":
        return "members"
    if slug not in _FINAL_VOTE_SLUGS:
        return "simple"
    t = f"{draft_title or ''} {document_title or ''}".lower()
    if "umbusaldus" in t:
        return "members"
    if "ettepaneku tegemine vabariigi valitsusele" in t or "ettepanek vabariigi valitsusele" in t:
        return "members"
    # §104 p11 covers the framework riigieelarve seadus, NOT annual "N. aasta riigieelarve"
    if "riigieelarve seadus" in t and "aasta" not in t:
        return "members"
    if any(re.search(p, t) for p in _P104_PATTERNS):
        return "members"
    return "simple"
