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


# Registration code -> (short_name, full party name). Seeded from 0001_initial.sql parties.
_CODE_TO_PARTY: dict[str, tuple[str, str]] = {
    "80043147": ("RE", "Eesti Reformierakond"),
    "80040344": ("EKRE", "Eesti Konservatiivne Rahvaerakond"),
    "80034740": ("KE", "Eesti Keskerakond"),
    "80529308": ("E200", "Erakond Eesti 200"),
    "80031010": ("SDE", "Sotsiaaldemokraatlik Erakond"),
    "80042700": ("I", "Erakond Isamaa"),
}


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
    """Map a party registration code to (short, full); fall back to the name un-abbreviated."""
    if code and code in _CODE_TO_PARTY:
        return _CODE_TO_PARTY[code]
    if name:
        return (name, name)  # short == full for parties not in the known-code table
    return None


def _norm(s: str) -> str:
    # collapse whitespace + casefold for tolerant name comparison
    return " ".join(s.split()).casefold()


def match_candidate(
    candidates: list[Candidate], *, full_name: str, date_of_birth: date | None
) -> Candidate | None:
    """Pick the best candidate from *candidates* for the given name and DOB.

    When *date_of_birth* is provided: return the first candidate that has a
    non-None ``person_id``, whose normalised name equals *full_name*, and whose
    ``date_of_birth`` equals the given DOB; else None.

    When *date_of_birth* is None: only a unique name match is accepted — if
    exactly one candidate has a non-None ``person_id`` and a normalised name
    equal to *full_name*, return it; if zero or more than one such candidate
    exist, return None (we will not guess among namesakes without a DOB).
    """
    norm_target = _norm(full_name)

    if date_of_birth is not None:
        # DOB provided: require exact name + DOB match.
        for c in candidates:
            if c.person_id is None:
                continue
            if _norm(c.full_name) != norm_target:
                continue
            if c.date_of_birth != date_of_birth:
                continue
            return c
        return None

    # No DOB: require unambiguous name match to avoid wrong-person errors.
    name_matches = [
        c for c in candidates if c.person_id is not None and _norm(c.full_name) == norm_target
    ]
    if len(name_matches) == 1:
        return name_matches[0]
    return None
