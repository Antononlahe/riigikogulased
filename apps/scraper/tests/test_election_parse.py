from parteidistsipliin_scraper.election_parse import (
    normalize_name,
    parse_dob_map,
    parse_election,
)

CANDIDATES_XML = """<?xml version="1.0" encoding="UTF-8"?>
<candidates xmlns="urn:x">
  <candidate><candidateId>10</candidateId><birthday>18.06.1977</birthday></candidate>
  <candidate><candidateId>20</candidateId><birthday>22.06.1975</birthday></candidate>
  <candidate><candidateId>30</candidateId><birthday>01.01.1980</birthday></candidate>
</candidates>"""

# National block (ehakCode 0000) with one party (two candidates: one elected, one not) and
# one elected independent. A district block (ehakCode 0001) must be ignored.
RESULTS_XML = """<?xml version="1.0" encoding="UTF-8"?>
<results xmlns="urn:x">
  <electionResult>
    <ehakCode>0000</ehakCode>
    <votesAndMandates>
      <party>
        <name>Reform</name><code>REF</code>
        <candidates>
          <candidate>
            <applicationId>10</applicationId><forename>KAJA</forename><surname>KALLAS</surname>
            <elected>true</elected><votes>31816</votes><districtNumber>4</districtNumber>
            <mandateType>PERSONAL</mandateType><quota>4.8212</quota>
          </candidate>
          <candidate>
            <applicationId>20</applicationId><forename>URMAS</forename><surname>REINSALU</surname>
            <elected>false</elected><votes>4509</votes><districtNumber>4</districtNumber>
            <mandateType>DISTRICT</mandateType><quota>0.6833</quota>
          </candidate>
        </candidates>
      </party>
    </votesAndMandates>
    <independentCandidates>
      <independentCandidate>
        <applicationId>30</applicationId><forename>MART</forename><surname>MARK</surname>
        <elected>true</elected><votes>900</votes><districtNumber>2</districtNumber>
        <mandateType>COMPENSATION</mandateType><quota>0.14</quota>
      </independentCandidate>
    </independentCandidates>
  </electionResult>
  <electionResult>
    <ehakCode>0001</ehakCode>
    <votesAndMandates><party><candidates>
      <candidate><applicationId>10</applicationId><forename>KAJA</forename><surname>KALLAS</surname>
      <elected>true</elected><votes>1</votes><mandateType>PERSONAL</mandateType></candidate>
    </candidates></party></votesAndMandates>
  </electionResult>
</results>"""


def test_parse_dob_map():
    assert parse_dob_map(CANDIDATES_XML) == {
        "10": "1977-06-18", "20": "1975-06-22", "30": "1980-01-01",
    }


def test_parse_election_only_elected_national_block():
    rows = parse_election(RESULTS_XML, CANDIDATES_XML)
    # Reinsalu not elected -> dropped; district block (0001) ignored -> Kallas appears once.
    assert [(r.surname, r.mandate_type) for r in rows] == [
        ("KALLAS", "PERSONAL"),
        ("MARK", "COMPENSATION"),
    ]
    kallas = rows[0]
    assert kallas.personal_votes == 31816
    assert kallas.district_number == 4
    assert kallas.party_code == "REF"
    assert kallas.dob == "1977-06-18"
    assert kallas.norm_name == "kaja kallas"
    assert rows[1].party_code is None  # independent


def test_normalize_name_casefold_and_whitespace():
    assert normalize_name("  KAJA   KALLAS ") == normalize_name("Kaja Kallas") == "kaja kallas"
