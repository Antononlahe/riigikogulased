"""Real-shape regression tests: run the pure mappers against committed live-API samples
under fixtures/api/eurovoc/ so a change in the API's JSON shape is caught offline."""

from __future__ import annotations

import json
from pathlib import Path

from parteidistsipliin_scraper.eurovoc_models import (
    parse_draft_descriptor_edids,
    parse_fields,
    parse_microthes_descriptors,
)

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "api" / "eurovoc"


def _load(name: str):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def test_parse_fields_on_real_tree():
    fields, micros = parse_fields(_load("fields-et.json"))
    # The live taxonomy has 21 top-level fields, each with >=1 microthesaurus.
    assert len(fields) == 21
    assert len(micros) >= 21
    f0 = fields[0]
    assert isinstance(f0.efid, int) and f0.text and f0.uuid
    # every microthesaurus row carries the efid of its parent field
    assert all(isinstance(m.field_efid, int) for m in micros)


def test_parse_microthes_descriptors_on_real_response():
    raw = _load("microthes-511-et.json")
    rows = parse_microthes_descriptors(raw)
    assert rows, "fixture microthesaurus should carry descriptors"
    assert all(r.microthesaurus_etid == raw["etid"] for r in rows)
    assert all(isinstance(r.edid, int) and r.text for r in rows)


def test_parse_draft_descriptor_edids_on_real_draft():
    pairs = parse_draft_descriptor_edids(_load("draft-sample.json"))
    assert pairs, "fixture draft should carry descriptors"
    assert all(isinstance(edid, int) and text for edid, text in pairs)
