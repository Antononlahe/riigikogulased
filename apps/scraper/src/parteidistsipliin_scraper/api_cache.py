"""Git-committed raw-JSON archive of API responses, under apps/scraper/cache/api/.

- ``votings.jsonl`` -- one raw `/api/votings/{uuid}` response per line; resumable by uuid.
- ``plenary-members.json`` -- the raw `/api/plenary-members` array (a snapshot).
- ``sessions.json`` -- the raw `/api/sessions` array (a snapshot).

The Riigikogu archive is immutable, so once a voting is cached we never refetch it.
``rebuild`` replays the cache into the database with no network.
"""

from __future__ import annotations

import json
from pathlib import Path

from parteidistsipliin_scraper.api_models import PlenaryMember, Session, Voting

CACHE_DIR = Path(__file__).resolve().parents[2] / "cache" / "api"


class ApiVoteCache:
    """Append-only raw-JSON cache of votings + a members snapshot."""

    def __init__(self, directory: Path | None = None) -> None:
        self.dir = directory or CACHE_DIR
        self.votings_file = self.dir / "votings.jsonl"
        self.members_file = self.dir / "plenary-members.json"
        self.sessions_file = self.dir / "sessions.json"
        self._seen: set[str] = set()
        if self.votings_file.exists():
            for line in self.votings_file.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line:
                    self._seen.add(json.loads(line)["uuid"])

    def has(self, uuid: str) -> bool:
        return uuid in self._seen

    def append_voting(self, raw: dict) -> None:
        """Persist one raw voting response. No-op if already cached."""
        key = raw["uuid"]
        if key in self._seen:
            return
        self.dir.mkdir(parents=True, exist_ok=True)
        with self.votings_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps(raw, ensure_ascii=False, separators=(",", ":")) + "\n")
        self._seen.add(key)

    def write_members(self, raw: list[dict]) -> None:
        self.dir.mkdir(parents=True, exist_ok=True)
        self.members_file.write_text(
            json.dumps(raw, ensure_ascii=False, indent=0), encoding="utf-8"
        )

    def write_sessions(self, raw: list[dict]) -> None:
        self.dir.mkdir(parents=True, exist_ok=True)
        self.sessions_file.write_text(
            json.dumps(raw, ensure_ascii=False, indent=0), encoding="utf-8"
        )

    def read_sessions(self) -> list[Session]:
        if not self.sessions_file.exists():
            return []
        raw = json.loads(self.sessions_file.read_text(encoding="utf-8"))
        return [Session.model_validate(s) for s in raw]

    def read_votings(self) -> list[Voting]:
        """Every cached voting as a Voting, sorted chronologically by startDateTime."""
        if not self.votings_file.exists():
            return []
        votings: list[Voting] = []
        for line in self.votings_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line:
                votings.append(Voting.model_validate_json(line))
        votings.sort(key=lambda v: v.startDateTime)
        return votings

    def read_members(self) -> list[PlenaryMember]:
        if not self.members_file.exists():
            return []
        raw = json.loads(self.members_file.read_text(encoding="utf-8"))
        return [PlenaryMember.model_validate(m) for m in raw]

    def __len__(self) -> int:
        return len(self._seen)
