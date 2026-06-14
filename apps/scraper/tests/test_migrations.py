from pathlib import Path

from parteidistsipliin_scraper.db import pending_migrations


def test_pending_migrations_orders_and_filters(tmp_path: Path):
    (tmp_path / "0001_initial.sql").write_text("-- 1", encoding="utf-8")
    (tmp_path / "0002_structure.sql").write_text("-- 2", encoding="utf-8")
    (tmp_path / "0003_more.sql").write_text("-- 3", encoding="utf-8")
    (tmp_path / "notes.txt").write_text("ignore me", encoding="utf-8")

    pend = pending_migrations(applied={"0001"}, migrations_dir=tmp_path)
    assert [p.name for p in pend] == ["0002_structure.sql", "0003_more.sql"]


def test_pending_migrations_empty_when_all_applied(tmp_path: Path):
    (tmp_path / "0001_initial.sql").write_text("-- 1", encoding="utf-8")
    assert pending_migrations(applied={"0001"}, migrations_dir=tmp_path) == []
