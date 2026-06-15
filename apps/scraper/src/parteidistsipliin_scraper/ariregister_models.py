from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class Candidate:
    full_name: str
    date_of_birth: date | None
    party_name: str | None
    person_id: str | None  # numeric RIK person id, or None when no history link


@dataclass(frozen=True)
class Membership:
    party_name: str
    registry_code: str | None
    started_on: date | None
    ended_on: date | None  # None = current


# Registration code -> (short_name, full party name), keyed on the six seeded parties.
# Codes verified against the live registry member_history pages (2026-06-15). The current
# Isamaa entity (80243584) is the renamed "Erakond Isamaa ja Res Publica Liit".
_CODE_TO_PARTY: dict[str, tuple[str, str]] = {
    "80043147": ("RE", "Eesti Reformierakond"),
    "80040344": ("EKRE", "Eesti Konservatiivne Rahvaerakond"),
    "80053370": ("KE", "Eesti Keskerakond"),
    "80551335": ("E200", "Erakond Eesti 200"),
    "80052459": ("SDE", "Sotsiaaldemokraatlik Erakond"),
    "80243584": ("I", "Erakond Isamaa"),
}

# Party display-name (as shown in the registry) -> (short, full). Used (a) as a fallback
# when a membership's registration code is unrecognised, and (b) for members whose search
# card has no "member history" link (single, stable membership) so the only signal is the
# current-party NAME on the card. Names are matched case/space-insensitively. The registry
# uses several name forms for the same party (e.g. "ISAMAA Erakond" vs "Erakond Isamaa ja
# Res Publica Liit"), all mapped here.
_NAME_TO_PARTY: dict[str, tuple[str, str]] = {
    "eesti reformierakond": ("RE", "Eesti Reformierakond"),
    "eesti konservatiivne rahvaerakond": ("EKRE", "Eesti Konservatiivne Rahvaerakond"),
    "ekre - eesti konservatiivne rahvaerakond": ("EKRE", "Eesti Konservatiivne Rahvaerakond"),
    "eesti keskerakond": ("KE", "Eesti Keskerakond"),
    "erakond eesti 200": ("E200", "Erakond Eesti 200"),
    "sotsiaaldemokraatlik erakond": ("SDE", "Sotsiaaldemokraatlik Erakond"),
    "isamaa erakond": ("I", "Erakond Isamaa"),
    "erakond isamaa": ("I", "Erakond Isamaa"),
    "erakond isamaa ja res publica liit": ("I", "Erakond Isamaa"),
}


def name_to_party(name: str | None) -> tuple[str, str] | None:
    """Map a registry party display-name to (short, full) via the known-name table."""
    if not name:
        return None
    return _NAME_TO_PARTY.get(_norm(name))


def card_to_party_term(party_name: str | None) -> PartyTerm | None:
    """Build a single open PartyTerm from a search card's current-party name.

    Used for members whose card carries no member-history link: their current party is the
    only datum, so we record one open-ended term (started_on/ended_on unknown -> NULL, which
    the discipline view treats as "covers the whole window"). Returns None if the party name
    is not a recognised parliamentary party (the member then stays excluded).
    """
    mapped = name_to_party(party_name)
    if mapped is None:
        return None
    short, full = mapped
    return PartyTerm(short, full, None, None)


@dataclass(frozen=True)
class PartyTerm:
    short: str
    full: str
    started_on: date | None
    ended_on: date | None


def memberships_to_party_terms(memberships: list[Membership]) -> list[PartyTerm]:
    """Map parsed memberships to PartyTerms, resolving party identity by registry code."""
    out: list[PartyTerm] = []
    for m in memberships:
        mapped = registry_code_to_party(m.registry_code, m.party_name)
        if mapped is None:
            continue
        short, full = mapped
        out.append(PartyTerm(short, full, m.started_on, m.ended_on))
    return out


def registry_code_to_party(code: str | None, name: str | None = None) -> tuple[str, str] | None:
    """Map a party to (short, full): registration code first, then known-name, then raw name.

    The code is the stable identity; a known display-name is the next-best signal (catches
    renamed/aliased parties whose code we don't seed); finally an unrecognised party falls
    back to ``(name, name)`` so ingestion never breaks (it just shows un-abbreviated and,
    having no Riigikogu faction, is excluded from scoring).
    """
    if code and code in _CODE_TO_PARTY:
        return _CODE_TO_PARTY[code]
    mapped = name_to_party(name)
    if mapped is not None:
        return mapped
    if name:
        return (name, name)  # short == full for parties not in either known table
    return None


def _norm(s: str) -> str:
    # collapse whitespace + casefold for tolerant name comparison
    return " ".join(s.split()).casefold()


def match_candidate(
    candidates: list[Candidate], *, full_name: str, date_of_birth: date | None
) -> Candidate | None:
    """Pick the best candidate from *candidates* for the given name and DOB.

    A match may be a candidate WITHOUT a ``person_id`` (no member-history link): such cards
    still carry the current-party name, which the caller can turn into a term via
    ``card_to_party_term``. When both a linked and an unlinked candidate match, the linked
    one wins (its history page gives the full dated transitions).

    When *date_of_birth* is provided: return the matching candidate (exact normalised name +
    DOB), preferring one with a ``person_id``; else None.

    When *date_of_birth* is None: only a unique name match is accepted (zero or more than one
    -> None), so we never guess among namesakes without a DOB.
    """
    norm_target = _norm(full_name)

    if date_of_birth is not None:
        matches = [
            c
            for c in candidates
            if _norm(c.full_name) == norm_target and c.date_of_birth == date_of_birth
        ]
        if not matches:
            return None
        with_id = [c for c in matches if c.person_id is not None]
        return with_id[0] if with_id else matches[0]

    # No DOB: require an unambiguous single name match to avoid wrong-person errors.
    name_matches = [c for c in candidates if _norm(c.full_name) == norm_target]
    if len(name_matches) == 1:
        return name_matches[0]
    return None
