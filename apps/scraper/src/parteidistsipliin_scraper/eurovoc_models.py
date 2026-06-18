from __future__ import annotations

from datetime import date
from typing import NamedTuple


class FieldRow(NamedTuple):
    efid: int
    uuid: str
    code: str | None
    text: str


class MicrothesRow(NamedTuple):
    etid: int
    uuid: str
    code: str | None
    text: str
    field_efid: int


class DescriptorRow(NamedTuple):
    edid: int
    uuid: str | None
    code: str | None
    text: str
    microthesaurus_etid: int | None


def parse_fields(raw: list[dict]) -> tuple[list[FieldRow], list[MicrothesRow]]:
    """Split the /api/eurovoc/fields tree into field rows + microthesaurus rows (etid->efid)."""
    fields: list[FieldRow] = []
    micros: list[MicrothesRow] = []
    for f in raw:
        efid = f["efid"]
        fields.append(FieldRow(efid=efid, uuid=f["uuid"], code=f.get("code"), text=f["text"]))
        for m in f.get("microThesauruses") or []:
            micros.append(
                MicrothesRow(
                    etid=m["etid"], uuid=m["uuid"], code=m.get("code"),
                    text=m["text"], field_efid=efid,
                )
            )
    return fields, micros


def parse_microthes_descriptors(raw: dict) -> list[DescriptorRow]:
    """Descriptor rows under one /api/eurovoc/microthes response, linked to its etid."""
    etid = raw["etid"]
    return [
        DescriptorRow(
            edid=d["edid"], uuid=d.get("uuid"), code=d.get("code"),
            text=d["text"], microthesaurus_etid=etid,
        )
        for d in raw.get("descriptors") or []
    ]


def parse_draft_descriptor_edids(raw: dict) -> list[tuple[int, str]]:
    """(edid, text) pairs for a draft's Eurovoc descriptors (text is the fallback label)."""
    return [(d["edid"], d.get("text", "")) for d in raw.get("descriptors") or []]


class DraftOutcome(NamedTuple):
    # activeDraftStage: VASTU_VOETUD (adopted), TAGASI_LYKATUD (rejected),
    # TAGASI_VOETUD (withdrawn), or a reading stage (still in process).
    stage: str | None
    status: str | None  # activeDraftStatus (finer status)
    accepted_on: date | None  # `accepted` adoption date, when present


def parse_draft_outcome(raw: dict) -> DraftOutcome:
    """The bill's final fate from /api/volumes/drafts/{uuid}: stage, status, adoption date."""
    accepted = raw.get("accepted")
    return DraftOutcome(
        stage=raw.get("activeDraftStage"),
        status=raw.get("activeDraftStatus"),
        accepted_on=date.fromisoformat(accepted) if accepted else None,
    )
