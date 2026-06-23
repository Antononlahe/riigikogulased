from __future__ import annotations

from pathlib import Path

CACHE_DIR = Path(__file__).resolve().parents[2] / "cache" / "election"


class ElectionCache:
    """Git-committed raw-XML archive of the RIA election open data.

    Two small static files per election (RESULTS + ELECTION_CANDIDATES), kept verbatim so an
    offline ``rebuild`` reproduces ``member_election_results`` with no network.
    """

    def __init__(self, directory: Path | None = None) -> None:
        self.dir = directory or CACHE_DIR

    def _path(self, election_code: str, file: str) -> Path:
        return self.dir / election_code / f"{file}.xml"

    def write(self, election_code: str, file: str, xml: str) -> None:
        p = self._path(election_code, file)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(xml, encoding="utf-8")

    def read(self, election_code: str, file: str) -> str | None:
        p = self._path(election_code, file)
        return p.read_text(encoding="utf-8") if p.exists() else None
