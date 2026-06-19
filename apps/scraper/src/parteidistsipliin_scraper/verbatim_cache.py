"""Git-committed gzip cache of raw verbatim sittings, under cache/api/verbatims/.

One ``<sittingId>.json.gz`` per sitting (id = the tail of the stenogram link, e.g.
``202606111000``). Verbatims are immutable once published, so a cached sitting is never
refetched; ``rebuild`` replays the cache (re-lemmatising) with no network. Gzip keeps the
~30 MB of term transcripts well under git's 100 MB limit.
"""

from __future__ import annotations

import gzip
import json
from pathlib import Path

CACHE_DIR = Path(__file__).resolve().parents[2] / "cache" / "api" / "verbatims"


def _sitting_id(sitting: dict) -> str:
    link = (sitting.get("link") or "").rstrip("/")
    tail = link.rsplit("/", 1)[-1] if link else ""
    return tail or (sitting.get("date") or "unknown").replace(":", "").replace("-", "")


class VerbatimCache:
    def __init__(self, directory: Path | None = None) -> None:
        self.dir = directory or CACHE_DIR

    def has(self, sitting: dict) -> bool:
        return (self.dir / f"{_sitting_id(sitting)}.json.gz").exists()

    def write_sitting(self, sitting: dict) -> bool:
        """Persist one raw sitting. Returns True if newly written, False if already cached."""
        path = self.dir / f"{_sitting_id(sitting)}.json.gz"
        if path.exists():
            return False
        self.dir.mkdir(parents=True, exist_ok=True)
        with gzip.open(path, "wt", encoding="utf-8") as f:
            json.dump(sitting, f, ensure_ascii=False, separators=(",", ":"))
        return True

    def read_all(self) -> list[dict]:
        if not self.dir.exists():
            return []
        out: list[dict] = []
        for path in sorted(self.dir.glob("*.json.gz")):
            with gzip.open(path, "rt", encoding="utf-8") as f:
                out.append(json.load(f))
        return out
