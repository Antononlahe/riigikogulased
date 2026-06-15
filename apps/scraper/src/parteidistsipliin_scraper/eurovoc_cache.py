from __future__ import annotations

import json
from pathlib import Path

CACHE_DIR = Path(__file__).resolve().parents[2] / "cache" / "api"


class EurovocCache:
    """Git-committed raw-JSON archive of the Eurovoc taxonomy + per-draft responses."""

    def __init__(self, directory: Path | None = None) -> None:
        self.dir = directory or CACHE_DIR
        self.eurovoc_dir = self.dir / "eurovoc"
        self.drafts_dir = self.dir / "drafts"

    def _read(self, p: Path):
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None

    def _write(self, p: Path, data) -> None:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(data, ensure_ascii=False, indent=0), encoding="utf-8")

    def write_fields(self, lang: str, raw: list) -> None:
        self._write(self.eurovoc_dir / f"fields-{lang}.json", raw)

    def read_fields(self, lang: str):
        return self._read(self.eurovoc_dir / f"fields-{lang}.json")

    def write_microthes(self, etid: int, lang: str, raw: dict) -> None:
        self._write(self.eurovoc_dir / f"microthes-{etid}-{lang}.json", raw)

    def read_microthes(self, etid: int, lang: str):
        return self._read(self.eurovoc_dir / f"microthes-{etid}-{lang}.json")

    def write_draft(self, draft_uuid: str, raw: dict) -> None:
        self._write(self.drafts_dir / f"{draft_uuid}.json", raw)

    def read_draft(self, draft_uuid: str):
        return self._read(self.drafts_dir / f"{draft_uuid}.json")
