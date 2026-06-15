from __future__ import annotations

import gzip
import re
from pathlib import Path

CACHE_DIR = Path(__file__).resolve().parents[2] / "cache" / "ariregister"


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.casefold()).strip("-") or "x"


class AriregisterCache:
    """Git-committed archive of äriregister search + member_history pages.

    Pages are stored gzip-compressed (``*.html.gz``): the search pages are large fuzzy
    result sets (~300 KB each, mostly noise), so gzip keeps the committed cache an order of
    magnitude smaller while preserving the raw HTML for an offline ``rebuild``.
    """

    def __init__(self, directory: Path | None = None) -> None:
        self.dir = directory or CACHE_DIR

    def _history_path(self, person_id: str) -> Path:
        return self.dir / f"history-{person_id}.html.gz"

    def _search_path(self, name: str) -> Path:
        return self.dir / f"search-{_slug(name)}.html.gz"

    def _write(self, path: Path, html: str) -> None:
        self.dir.mkdir(parents=True, exist_ok=True)
        path.write_bytes(gzip.compress(html.encode("utf-8")))

    def _read(self, path: Path) -> str | None:
        if not path.exists():
            return None
        return gzip.decompress(path.read_bytes()).decode("utf-8")

    def write_history(self, person_id: str, html: str) -> None:
        self._write(self._history_path(person_id), html)

    def read_history(self, person_id: str) -> str | None:
        return self._read(self._history_path(person_id))

    def has_history(self, person_id: str) -> bool:
        return self._history_path(person_id).exists()

    def write_search(self, name: str, html: str) -> None:
        self._write(self._search_path(name), html)

    def read_search(self, name: str) -> str | None:
        return self._read(self._search_path(name))
