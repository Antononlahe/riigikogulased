from __future__ import annotations

import re
from pathlib import Path

CACHE_DIR = Path(__file__).resolve().parents[2] / "cache" / "ariregister"


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.casefold()).strip("-") or "x"


class AriregisterCache:
    """Raw-HTML archive of search + member_history pages under cache/ariregister/."""

    def __init__(self, directory: Path | None = None) -> None:
        self.dir = directory or CACHE_DIR

    def _history_path(self, person_id: str) -> Path:
        return self.dir / f"history-{person_id}.html"

    def _search_path(self, name: str) -> Path:
        return self.dir / f"search-{_slug(name)}.html"

    def write_history(self, person_id: str, html: str) -> None:
        self.dir.mkdir(parents=True, exist_ok=True)
        self._history_path(person_id).write_text(html, encoding="utf-8")

    def read_history(self, person_id: str) -> str | None:
        p = self._history_path(person_id)
        return p.read_text(encoding="utf-8") if p.exists() else None

    def has_history(self, person_id: str) -> bool:
        return self._history_path(person_id).exists()

    def write_search(self, name: str, html: str) -> None:
        self.dir.mkdir(parents=True, exist_ok=True)
        self._search_path(name).write_text(html, encoding="utf-8")

    def read_search(self, name: str) -> str | None:
        p = self._search_path(name)
        return p.read_text(encoding="utf-8") if p.exists() else None
