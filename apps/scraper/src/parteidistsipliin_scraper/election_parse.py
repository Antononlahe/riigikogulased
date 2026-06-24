"""Parse RIA election open data (opendata.valimised.ee) into elected-MP result rows.

Two namespaced XML files per election:
  - RESULTS.xml             -> elected flag, personal votes, mandateType, quota, district, party
  - ELECTION_CANDIDATES.xml -> birthday (DOB) keyed by candidateId == RESULTS.applicationId

The national result block (ehakCode 0000) carries the authoritative mandate assignment, so
only it is walked. Each elected candidate becomes one ElectionResult; the caller matches it to
a member by full name + date_of_birth (the äriregister key).
"""

from __future__ import annotations

import re
import unicodedata
import xml.etree.ElementTree as ET
from dataclasses import dataclass

MANDATE_TYPES = {"PERSONAL", "DISTRICT", "COMPENSATION"}


@dataclass(frozen=True)
class ElectionResult:
    forename: str
    surname: str
    dob: str | None  # ISO YYYY-MM-DD
    party_code: str | None
    district_number: int | None
    personal_votes: int
    quota: str | None  # kept as string; DB column is NUMERIC
    elected: bool
    mandate_type: str | None  # PERSONAL | DISTRICT | COMPENSATION; None if not elected

    @property
    def norm_name(self) -> str:
        return normalize_name(f"{self.forename} {self.surname}")


def normalize_name(s: str | None) -> str:
    """NFC + casefold + collapse whitespace, for matching ALL-CAPS XML names to members."""
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", (s or "").strip().casefold()))


def _root(xml: str) -> ET.Element:
    """Parse XML text and strip namespaces (valimised XML is heavily namespaced)."""
    root = ET.fromstring(xml)
    for el in root.iter():
        el.tag = el.tag.split("}")[-1]
    return root


def _dob_from_birthday(bd: str | None) -> str | None:
    """'21.05.1968' -> '1968-05-21'."""
    if not bd:
        return None
    try:
        d, m, y = bd.split(".")
        return f"{y}-{m}-{d}"
    except ValueError:
        return None


def parse_dob_map(candidates_xml: str) -> dict[str, str]:
    """candidateId -> ISO DOB, from ELECTION_CANDIDATES.xml."""
    out: dict[str, str] = {}
    for c in _root(candidates_xml).iter("candidate"):
        cid = c.findtext("candidateId")
        dob = _dob_from_birthday(c.findtext("birthday"))
        if cid and dob:
            out[cid] = dob
    return out


def _int_or_none(s: str | None) -> int | None:
    try:
        return int(s) if s not in (None, "") else None
    except ValueError:
        return None


def _candidate_result(
    c: ET.Element, party_code: str | None, dob_by_appid: dict[str, str]
) -> ElectionResult:
    appid = c.findtext("applicationId")
    mandate = c.findtext("mandateType")
    return ElectionResult(
        forename=c.findtext("forename") or "",
        surname=c.findtext("surname") or "",
        dob=dob_by_appid.get(appid or ""),
        party_code=party_code,
        district_number=_int_or_none(c.findtext("districtNumber")),
        personal_votes=int(c.findtext("votes") or 0),
        quota=c.findtext("quota"),
        elected=c.findtext("elected") == "true",
        mandate_type=mandate if mandate in MANDATE_TYPES else None,
    )


def parse_candidates(results_xml: str, dob_by_appid: dict[str, str]) -> list[ElectionResult]:
    """One ElectionResult per candidate in the national block (ehakCode 0000) -- BOTH elected
    and not. The 0000 block lists every candidate; non-elected ones carry their personal votes
    but no mandateType. The caller matches to members (so non-MPs are dropped) and decides which
    to keep."""
    out: list[ElectionResult] = []
    for er in _root(results_xml).iter("electionResult"):
        if er.findtext("ehakCode") != "0000":
            continue
        vm = er.find("votesAndMandates")
        if vm is None:
            continue
        for party in vm.findall("party"):
            cs = party.find("candidates")
            if cs is None:
                continue
            for c in cs.findall("candidate"):
                out.append(_candidate_result(c, party.findtext("code"), dob_by_appid))
        inds = er.find("independentCandidates")
        if inds is not None:
            for c in inds.findall("independentCandidate"):
                out.append(_candidate_result(c, None, dob_by_appid))
    return out


def parse_election(results_xml: str, candidates_xml: str) -> list[ElectionResult]:
    """Full parse: every candidate (elected + not) with personal votes, mandate type, and DOB."""
    return parse_candidates(results_xml, parse_dob_map(candidates_xml))
