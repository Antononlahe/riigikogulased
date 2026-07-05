"""Git-committed gzip cache of raw member profile HTML, under cache/profiles/<uuid>.html.gz.

Profiles change slowly; a cached page is reused unless --refresh. `rebuild` replays the cache
with no network. Gzip keeps ~101 * ~180 KB pages compact. Mirrors VerbatimCache.
"""

from __future__ import annotations

import gzip
from pathlib import Path

CACHE_DIR = Path(__file__).resolve().parents[2] / "cache" / "profiles"


class ProfileCache:
    def __init__(self, directory: Path | None = None) -> None:
        self.dir = directory or CACHE_DIR

    def _path(self, uuid: str) -> Path:
        return self.dir / f"{uuid}.html.gz"

    def has(self, uuid: str) -> bool:
        return self._path(uuid).exists()

    def write(self, uuid: str, html: str) -> None:
        self.dir.mkdir(parents=True, exist_ok=True)
        with gzip.open(self._path(uuid), "wt", encoding="utf-8") as f:
            f.write(html)

    def read(self, uuid: str) -> str | None:
        path = self._path(uuid)
        if not path.exists():
            return None
        with gzip.open(path, "rt", encoding="utf-8") as f:
            return f.read()

    def read_all(self) -> dict[str, str]:
        if not self.dir.exists():
            return {}
        out: dict[str, str] = {}
        for path in sorted(self.dir.glob("*.html.gz")):
            uuid = path.name.removesuffix(".html.gz")
            with gzip.open(path, "rt", encoding="utf-8") as f:
                out[uuid] = f.read()
        return out
