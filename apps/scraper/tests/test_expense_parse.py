from decimal import Decimal

from parteidistsipliin_scraper.expense_parse import parse_koond, parse_liikide, parse_year

KOOND = (
    "erakond,huvitisesaaja,limiit,kulud,kasutamata,kasutatud_pct,volituste_algus\n"
    'Eesti Reformierakond,Aivar Kokk,14598.45,13144.56,1012.49,"93,1%",01.04.2023\n'
    'Eesti Keskerakond,Mari Maa,21012.06,,2475.60,"88,2%",01.04.2023\n'  # blank spent -> dropped
    ',KOKKU,1889287.31,1452594.71,436692.60,"76,9%",\n'  # total row -> skipped
)

LIIKIDE = (
    "huvitisesaaja,kokku,sõidukulud,side_ja_postikulud,lähetuskulud,majutuskulud,bürookulud,"
    "koolituskulud,tõlketeenuse_kulud,uuringud_ja_ekspertiisid,esindus_ja_vastuvõtukulud,"
    "tervishoiuteenused\n"
    "Aivar Kokk,13144.56,6779.68,477.76,,,2163.78,,,,3723.34,\n"
    "KOKKU,944606.82,434376.36,90460.72,67864.36,12941.21,59441.60,20841.23,2578.69,7621.20,"
    "248327.45,154.00\n"
)


def test_parse_koond_skips_total_and_blank_spent():
    out = parse_koond(KOOND)
    assert set(out) == {"aivar kokk"}  # KOKKU + the blank-spent Mari Maa both excluded
    raw, limit, spent = out["aivar kokk"]
    assert raw == "Aivar Kokk"
    assert limit == Decimal("14598.45")
    assert spent == Decimal("13144.56")


def test_parse_liikide_skips_total_and_blanks():
    out = parse_liikide(LIIKIDE)
    assert set(out) == {"aivar kokk"}
    bd = out["aivar kokk"]
    # Only non-blank categories are kept.
    assert bd == {
        "sõidukulud": 6779.68,
        "side_ja_postikulud": 477.76,
        "bürookulud": 2163.78,
        "esindus_ja_vastuvõtukulud": 3723.34,
    }


def test_parse_year_joins_breakdown_onto_koond_spine():
    rows = parse_year(KOOND, LIIKIDE, 2023)
    assert len(rows) == 1
    r = rows[0]
    assert r.norm_name == "aivar kokk" and r.year == 2023
    assert r.spent_eur == Decimal("13144.56")
    # liikide kokku must equal koond kulud (cross-check the two sources agree).
    assert round(sum(r.breakdown.values()), 2) == float(r.spent_eur)
    assert r.breakdown["sõidukulud"] == 6779.68
