from parteidistsipliin_scraper.eurovoc_cache import EurovocCache


def test_fields_roundtrip(tmp_path):
    c = EurovocCache(directory=tmp_path)
    assert c.read_fields("et") is None
    c.write_fields("et", [{"efid": 64}])
    assert c.read_fields("et") == [{"efid": 64}]


def test_microthes_roundtrip(tmp_path):
    c = EurovocCache(directory=tmp_path)
    c.write_microthes(515, "en", {"etid": 515})
    assert c.read_microthes(515, "en") == {"etid": 515}
    assert c.read_microthes(999, "en") is None


def test_draft_roundtrip(tmp_path):
    c = EurovocCache(directory=tmp_path)
    c.write_draft("u1", {"uuid": "u1", "descriptors": []})
    assert c.read_draft("u1")["uuid"] == "u1"
    assert c.read_draft("nope") is None
