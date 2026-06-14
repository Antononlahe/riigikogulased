from __future__ import annotations

from typing import Literal

Choice = Literal["yes", "no", "abstain", "absent", "neutral"]


def normalize_faction(name: str | None) -> str | None:
    """Map a Riigikogu faction label to a party name, or ``None`` for non-attached.

    Members who belong to no fraktsioon are listed under a pseudo-faction
    ("Fraktsiooni mittekuuluvad ..."). They share no party line, so they are stored
    with ``party_id = NULL`` and excluded from discipline scoring.
    """
    if not name:
        return None
    cleaned = " ".join(name.split())
    if "mittekuuluv" in cleaned.lower():
        return None
    return cleaned or None


# Riigikogu fraktsioon names -> (short_name, full party name). Keeps `parties` keyed on
# the stable abbreviations seeded in 0001_initial.sql.
_FACTION_TO_PARTY: dict[str, tuple[str, str]] = {
    "Eesti Reformierakonna fraktsioon": ("RE", "Eesti Reformierakond"),
    "Eesti Konservatiivse Rahvaerakonna fraktsioon": ("EKRE", "Eesti Konservatiivne Rahvaerakond"),
    "Eesti Keskerakonna fraktsioon": ("KE", "Eesti Keskerakond"),
    "Eesti 200 fraktsioon": ("E200", "Erakond Eesti 200"),
    "Sotsiaaldemokraatliku Erakonna fraktsioon": ("SDE", "Sotsiaaldemokraatlik Erakond"),
    "Isamaa fraktsioon": ("I", "Erakond Isamaa"),
}


def faction_to_party(name: str | None) -> tuple[str, str] | None:
    """Return ``(short_name, full_name)`` for a fraktsioon, or ``None`` for non-attached.

    Falls back to ``(faction, faction)`` for an unrecognized fraktsioon so a renamed or
    new faction never breaks ingestion (it just shows un-abbreviated).
    """
    n = normalize_faction(name)
    if n is None:
        return None
    return _FACTION_TO_PARTY.get(n, (n, n))
