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


def registry_code_to_party(code: str | None, name: str | None = None) -> tuple[str, str] | None:
    """Map a party registration code to (short, full); fall back to the name un-abbreviated."""
    if code and code in _CODE_TO_PARTY:
        return _CODE_TO_PARTY[code]
    if name:
        return (name, name)
    return None


def _norm(s: str) -> str:
    return " ".join(s.split()).casefold()


def match_candidate(
    candidates: list[Candidate], *, full_name: str, date_of_birth: date | None
) -> Candidate | None:
    """Pick the candidate whose name and DOB match exactly and that has a history link."""
    for c in candidates:
        if c.person_id is None:
            continue
        if _norm(c.full_name) != _norm(full_name):
            continue
        if date_of_birth is not None and c.date_of_birth != date_of_birth:
            continue
        return c
    return None
