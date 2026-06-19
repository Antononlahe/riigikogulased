from parteidistsipliin_scraper.verbatim_parse import SpeechRecord, match_speaker, parse_sitting

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
        "agendaItems": [
            {
                "title": "Riigikaitse",
                "events": [
                    # member speech (event link null -> falls back to sitting link)
                    {"type": "SPEECH", "uuid": "spk1", "date": "2026-06-11T10:00:08.000+00:00",
                     "speaker": "Rain Epler", "text": "Tere, austatud Riigikogu!", "link": None},
                    # member speech with a NULL event uuid -> still kept (uuid is speaker id)
                    {"type": "SPEECH", "uuid": None, "date": "2026-06-11T10:09:00.000+00:00",
                     "speaker": "Esimees Lauri Hussar", "text": "Aitäh!", "link": "y"},
                    # non-member speaker -> dropped
                    {"type": "SPEECH", "uuid": "spk2", "date": "2026-06-11T10:05:00.000+00:00",
                     "speaker": "Külaline Mari Maa", "text": "Tervist.", "link": "x"},
                    # not a speech event -> dropped
                    {"type": "VOTING_EVENT", "uuid": "spk3", "speaker": None, "text": "FOR"},
                    # empty text -> dropped
                    {"type": "SPEECH", "uuid": "spk4", "speaker": "Mart Helme", "text": "   "},
                ],
            }
        ],
    }
    recs = parse_sitting(sitting, NAME_TO_ID)
    assert len(recs) == 2  # Epler + Hussar (null-uuid kept); non-member, non-speech, empty dropped
    epler = recs[0]
    assert isinstance(epler, SpeechRecord)
    assert epler.member_id == 1
    assert epler.speaker_uuid == "spk1"
    assert epler.sitting_date == "2026-06-11"
    assert epler.agenda_title == "Riigikaitse"
    # event link is null -> falls back to the sitting link
    assert epler.steno_link == "https://stenogrammid.riigikogu.ee/202606111000"
    # per-utterance key is a stable content hash, distinct per speech, never null
    assert len(epler.speech_key) == 40 and epler.speech_key != recs[1].speech_key
