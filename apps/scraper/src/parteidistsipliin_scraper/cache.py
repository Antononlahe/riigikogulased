"""On-disk cache of parsed vote data, committed to git.

This stores the *distilled* result of scraping (not raw HTML, which is ~50x larger and
gitignored under raw_html/). Two files under apps/scraper/cache/:

- ``votes.jsonl`` -- one compact JSON object per vote, the fields needed to rebuild the
  database: uuid, timestamp, title, title-derived slug, tallies, and ballots as
  ``[member_uuid, choice, faction-at-time-or-null]``.
- ``members.json`` -- ``{member_uuid: full_name}``, so names aren't repeated on every
  ballot line.

Purpose: the Riigikogu archive is immutable, so once a vote is cached we never need to
fetch it again. ``rebuild`` replays the cache into the database with no network, which
makes iterating on the writer / discipline / party-term logic fast and polite.
"""

from __future__ import annotations

import json
from collections.abc import Iterable
from pathlib import Path
from uuid import UUID

from parteidistsipliin_scraper.models import Ballot, VoteDetail

CACHE_DIR = Path(__file__).resolve().parents[2] / "cache"


class VoteCache:
    """Append-only cache of parsed votes. Resumable: ``has`` reflects what is on disk."""

    def __init__(self, directory: Path | None = None) -> None:
        self.dir = directory or CACHE_DIR
        self.votes_file = self.dir / "votes.jsonl"
        self.members_file = self.dir / "members.json"
        self._members: dict[str, str] = {}
        self._seen: set[str] = set()
        if self.members_file.exists():
            self._members = json.loads(self.members_file.read_text(encoding="utf-8"))
        if self.votes_file.exists():
            for line in self.votes_file.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line:
                    self._seen.add(json.loads(line)["uuid"])

    def has(self, uuid: UUID | str) -> bool:
        return str(uuid) in self._seen

    def append(self, detail: VoteDetail) -> None:
        """Persist one parsed vote. No-op if already cached."""
        key = str(detail.riigikogu_uuid)
        if key in self._seen:
            return
        record = {
            "uuid": key,
            "voted_at": detail.voted_at.isoformat(),
            "title": detail.title,
            "vote_type_slug": detail.vote_type_slug,
            "counts": [
                detail.yes_count,
                detail.no_count,
                detail.abstain_count,
                detail.absent_count,
            ],
            "ballots": [
                [b.member_riigikogu_id, b.choice, b.party_short_name] for b in detail.ballots
            ],
        }
        self.dir.mkdir(parents=True, exist_ok=True)
        with self.votes_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
        self._seen.add(key)
        for b in detail.ballots:
            self._members[b.member_riigikogu_id] = b.member_full_name
        # members.json is tiny (~5 KB); rewriting it per vote keeps the cache crash-safe.
        self.members_file.write_text(
            json.dumps(self._members, ensure_ascii=False, sort_keys=True, indent=0),
            encoding="utf-8",
        )

    def read_all(self) -> list[VoteDetail]:
        """Load every cached vote, reconstructed as VoteDetail, sorted chronologically.

        Chronological order matters: party-term transitions are derived from the order
        in which a member's faction changes across votes.
        """
        if not self.votes_file.exists():
            return []
        members = self._members
        details: list[VoteDetail] = []
        for line in self.votes_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            yes, no, abstain, absent = rec["counts"]
            ballots: list[Ballot] = [
                Ballot(
                    member_riigikogu_id=bid,
                    member_full_name=members.get(bid, ""),
                    party_short_name=faction,
                    choice=choice,
                )
                for bid, choice, faction in rec["ballots"]
            ]
            details.append(
                VoteDetail(
                    riigikogu_uuid=UUID(rec["uuid"]),
                    voted_at=rec["voted_at"],
                    title=rec["title"],
                    vote_type_slug=rec["vote_type_slug"],
                    yes_count=yes,
                    no_count=no,
                    abstain_count=abstain,
                    absent_count=absent,
                    ballots=ballots,
                )
            )
        details.sort(key=lambda d: d.voted_at)
        return details

    def __len__(self) -> int:
        return len(self._seen)


def append_all(details: Iterable[VoteDetail], directory: Path | None = None) -> int:
    cache = VoteCache(directory)
    n = 0
    for d in details:
        if not cache.has(d.riigikogu_uuid):
            cache.append(d)
            n += 1
    return n
