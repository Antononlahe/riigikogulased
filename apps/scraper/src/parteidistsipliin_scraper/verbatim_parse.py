"""Pure parsing of /api/steno/verbatims sitting transcripts into per-member speech records.

A verbatim sitting is ``{link, date, title, agendaItems: [{title, events: [...]}]}``. Each
event is ``{type, uuid, date, speaker, text, link}``; spoken content is ``type == "SPEECH"``.

Two gotchas the parser handles:
- ``speaker`` is a display string -- either a bare full name ("Rain Epler") or a role-prefixed
  one ("Aseesimees Toomas Kivimägi", "Energeetika- ja keskkonnaminister Andres Sutt"). We
  attribute a speech to a member by matching the trailing full name; speakers we don't
  recognise as members (external ministers, guests) are dropped.
- ``uuid`` is the SPEAKER's person id (repeated across all their speeches, sometimes null),
  NOT a per-utterance id. So the stable per-speech key is a content hash.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass


@dataclass(frozen=True)
class SpeechRecord:
    speech_key: str             # sha1 content hash; stable per utterance, idempotent re-ingest
    member_id: int
    speaker_uuid: str | None    # the event's speaker id (provenance only; not unique)
    spoken_at: str | None       # ISO datetime string from the event
    sitting_date: str | None    # YYYY-MM-DD
    agenda_title: str | None
    steno_link: str | None
    text: str


def match_speaker(speaker: str | None, name_to_id: dict[str, int]) -> int | None:
    """Resolve a verbatim ``speaker`` string to a member id, or None.

    Exact full-name match wins; otherwise the speaker must END WITH " <full name>" (a role
    prefix in front), and the LONGEST such full name is chosen so a shorter name that is a
    suffix of a longer colleague's name never shadows it.
    """
    if not speaker:
        return None
    if speaker in name_to_id:
        return name_to_id[speaker]
    best_name: str | None = None
    for name in name_to_id:
        if speaker.endswith(" " + name) and (best_name is None or len(name) > len(best_name)):
            best_name = name
    return name_to_id[best_name] if best_name else None


def _speech_key(link: str | None, ts: str | None, speaker: str | None, text: str) -> str:
    raw = f"{link}|{ts}|{speaker}|{text[:80]}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def parse_sitting(sitting: dict, name_to_id: dict[str, int]) -> list[SpeechRecord]:
    """Every member-attributed SPEECH event in one verbatim sitting."""
    sitting_link = sitting.get("link")
    sitting_date = (sitting.get("date") or "")[:10] or None
    out: list[SpeechRecord] = []
    for ai in sitting.get("agendaItems", []) or []:
        agenda_title = ai.get("title")
        for ev in ai.get("events", []) or []:
            if ev.get("type") != "SPEECH":
                continue
            text = (ev.get("text") or "").strip()
            if not text:
                continue
            member_id = match_speaker(ev.get("speaker"), name_to_id)
            if member_id is None:
                continue
            ts = ev.get("date")
            out.append(
                SpeechRecord(
                    speech_key=_speech_key(sitting_link, ts, ev.get("speaker"), text),
                    member_id=member_id,
                    speaker_uuid=ev.get("uuid"),
                    spoken_at=ts,
                    sitting_date=sitting_date,
                    agenda_title=agenda_title,
                    steno_link=ev.get("link") or sitting_link,
                    text=text,
                )
            )
    return out
