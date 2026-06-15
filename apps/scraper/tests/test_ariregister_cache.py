from parteidistsipliin_scraper.ariregister_cache import AriregisterCache


def test_roundtrip_history(tmp_path):
    cache = AriregisterCache(directory=tmp_path)
    cache.write_history("9000034247", "<html>laneman</html>")
    assert cache.has_history("9000034247")
    assert "laneman" in cache.read_history("9000034247")


def test_roundtrip_search(tmp_path):
    cache = AriregisterCache(directory=tmp_path)
    cache.write_search("Alar Laneman", "<html>s</html>")
    assert "s" in cache.read_search("Alar Laneman")


def test_missing_returns_none(tmp_path):
    cache = AriregisterCache(directory=tmp_path)
    assert cache.read_history("nope") is None
    assert not cache.has_history("nope")
