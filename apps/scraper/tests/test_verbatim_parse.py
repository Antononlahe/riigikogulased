from parteidistsipliin_scraper.verbatim_parse import (
    SpeechRecord,
    match_speaker,
    parse_sitting,
    sitting_type_of,
)

NAME_TO_ID = {"Rain Epler": 1, "Lauri Hussar": 2, "Andres Sutt": 3, "Mart Helme": 4}


def test_match_speaker_exact_and_prefixed():
    assert match_speaker("Rain Epler", NAME_TO_ID) == 1
    # role prefixes in front of the full name
    assert match_speaker("Esimees Lauri Hussar", NAME_TO_ID) == 2
    assert match_speaker("Energeetika- ja keskkonnaminister Andres Sutt", NAME_TO_ID) == 3


def test_match_speaker_unknown_and_none():
    assert match_speaker("Minister Jaanus Tamm", NAME_TO_ID) is None  # not a member
    assert match_speaker(None, NAME_TO_ID) is None
    assert match_speaker("", NAME_TO_ID) is None


def test_match_speaker_suffix_not_a_false_partial():
    # "...Epler" without a space boundary must not match "Rain Epler"
    assert match_speaker("KaarelEpler", NAME_TO_ID) is None


def test_parse_sitting_extracts_only_member_speeches():
    sitting = {
        "link": "https://stenogrammid.riigikogu.ee/202606111000",
        "date": "2026-06-11T07:00:00.000+00:00",
        "title": "XV Riigikogu, VII istungjärk, infotund",
        "agendaItems": [
            {
                "title": "<p>Riigikaitse</p>",  # HTML is stripped at parse
                "events": [
                    # member speech (>= MIN_TEXT_LEN; null event link -> sitting link)
                    {"type": "SPEECH", "uuid": "spk1", "date": "2026-06-11T10:00:08.000+00:00",
                     "speaker": "Rain Epler", "link": None,
                     "text": "Riigikaitse rahastamine vajab pikaajalist ja väga selget plaani."},
                    # member speech with a NULL event uuid -> still kept (uuid is speaker id)
                    {"type": "SPEECH", "uuid": None, "date": "2026-06-11T10:09:00.000+00:00",
                     "speaker": "Esimees Lauri Hussar",
                     "text": "Tänan ettekande eest, läheme edasi järgmise punkti juurde nüüd."},
                    # non-member speaker -> dropped
                    {"type": "SPEECH", "uuid": "spk2", "speaker": "Külaline Mari Maa",
                     "text": "Tervitan kõiki Riigikogu liikmeid ja tänan esinemise eest siin."},
                    # too short (< MIN_TEXT_LEN) procedural call -> dropped
                    {"type": "SPEECH", "uuid": "spk5", "speaker": "Mart Helme",
                     "text": "Madis Kallas, palun!"},
                    # not a speech event -> dropped
                    {"type": "VOTING_EVENT", "uuid": "spk3", "speaker": None, "text": "FOR"},
                    # empty text -> dropped
                    {"type": "SPEECH", "uuid": "spk4", "speaker": "Mart Helme", "text": "   "},
                ],
            }
        ],
    }
    recs = parse_sitting(sitting, NAME_TO_ID)
    # Epler + Hussar (null-uuid kept); dropped: non-member, too-short call, non-speech, empty
    assert len(recs) == 2
    epler = recs[0]
    assert isinstance(epler, SpeechRecord)
    assert epler.member_id == 1
    assert epler.speaker_uuid == "spk1"
    assert epler.sitting_date == "2026-06-11"
    assert epler.sitting_type == "infotund"
    assert epler.agenda_title == "Riigikaitse"  # <p> stripped
    # event link is null -> falls back to the sitting link
    assert epler.steno_link == "https://stenogrammid.riigikogu.ee/202606111000"
    # per-utterance key is a stable content hash, distinct per speech, never null
    assert len(epler.speech_key) == 40 and epler.speech_key != recs[1].speech_key


def test_sitting_type_of():
    assert sitting_type_of("XV Riigikogu, VII istungjärk, täiskogu istung") == "istung"
    assert sitting_type_of("XV Riigikogu, V istungjärk, infotund") == "infotund"
    assert sitting_type_of("XV Riigikogu, Riigikogu erakorraline istungjärk") == "erakorraline"
    assert sitting_type_of("XV Riigikogu, III istungjärk, täiskogu täiendav istung") == "taiendav"
    assert sitting_type_of("Ukraina presidendi kõne") == "eri"
    assert sitting_type_of(None) == "eri"
