from parteidistsipliin_scraper.eurovoc_models import (
    DescriptorRow,
    FieldRow,
    MicrothesRow,
    parse_draft_descriptor_edids,
    parse_fields,
    parse_microthes_descriptors,
)

FIELDS_RAW = [
    {
        "uuid": "f-uuid", "efid": 64, "code": "64", "text": "TOOTMINE",
        "microThesauruses": [{"uuid": "m-uuid", "etid": 608, "code": "6416", "text": "uurimine"}],
    }
]
MICROTHES_RAW = {
    "uuid": "m-uuid", "etid": 515, "code": "0436", "text": "avalik teenistus",
    "descriptors": [{"uuid": "d-uuid", "edid": 77, "code": "77", "text": "avalik haldus"}],
}
DRAFT_RAW = {
    "uuid": "v-uuid", "mark": 866, "descriptors": [{"edid": 2695, "text": "haldusmenetlus"}],
}


def test_parse_fields_returns_field_and_microthes_rows():
    fields, micros = parse_fields(FIELDS_RAW)
    assert fields == [FieldRow(efid=64, uuid="f-uuid", code="64", text="TOOTMINE")]
    assert micros == [
        MicrothesRow(etid=608, uuid="m-uuid", code="6416", text="uurimine", field_efid=64)
    ]


def test_parse_microthes_descriptors_links_to_microthesaurus():
    rows = parse_microthes_descriptors(MICROTHES_RAW)
    assert rows == [
        DescriptorRow(
            edid=77, uuid="d-uuid", code="77", text="avalik haldus", microthesaurus_etid=515
        )
    ]


def test_parse_draft_descriptor_edids():
    assert parse_draft_descriptor_edids(DRAFT_RAW) == [(2695, "haldusmenetlus")]


def test_parse_draft_no_descriptors_is_empty():
    assert parse_draft_descriptor_edids({"uuid": "x", "descriptors": []}) == []
    assert parse_draft_descriptor_edids({"uuid": "x"}) == []
