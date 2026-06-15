# äriregister fixtures

Raw HTML captured live from `https://ariregister.rik.ee/est/political_party/` on
2026-06-15, committed so all parser tests run offline. Attribution: RIK äriregister.

## Page structure (important for parsers)

The **search** page (`members_search?person_name=...`) is **card-based**, not a `<table>`.
Each result is a card whose text reads, in order:

```
Sulge  Eesnimi <first>  Perekonnanimi <last>  Isikukood / sünniaeg <DD.MM.YYYY>
Erakond <party name>  Liikmeks astumise aeg <DD.MM.YYYY>  Liikme ajalugu
```

The "Liikme ajalugu" (member history) text is an `<a href=".../member_history/<id>">`.
Name search is fuzzy/prefix, so a page holds up to ~100 cards — the exact person is
selected by exact name + date of birth. Parse strategy: find each `member_history/<id>`
anchor, climb to its enclosing card block, regex the DOB (`\d{2}\.\d{2}\.\d{4}`) and the
party (`Erakond <X> Liikmeks`).

The **member_history** page (`member_history/<id>`) shows the person's dated party
memberships (party name + 8-digit registration code, joined date, left date, status).

## Fixtures and the case each covers

| File | Person | Case |
| --- | --- | --- |
| `search_laneman.html` | Alar Laneman, 06.05.1962 → id 9000034247 | exact match in a fuzzy result set |
| `history_laneman.html` | Laneman (id 9000034247) | **non-attached + party**: RE current (joined 12.07.2024), EKRE ended (left 14.06.2024) — two dated memberships |
| `history_grunthal.html` | id 2000000580 | **all memberships ended** (EKRE `80040344` 2017→2023; older party `80131035` 2002→2005) — registry-code mapping + the "no current party" parse case |
| `search_kunnas.html` | Leo Kunnas, 14.11.1967 | **no registry match**: no card matches his name+DOB → matcher returns None → member stays excluded |
| `search_collision.html` | "Jaan Tamm" | name collision: many cards; resolution needs DOB |

Note on real data (from the 2026-06-15 capture of all 17 non-attached members): 16 of 17
have a current registry party that maps to one of the six seeded parties (e.g. several
ex-EKRE/ex-KE members now show ISAMAA/SDE/KE). Two stay excluded after the fix and that is
correct: **Leo Kunnas** (no registry party) and **Jaak Valge** (member of a
non-parliamentary party with no Riigikogu faction, so no party line exists to score
against). Party-name strings in the registry can differ from our seeded full names (e.g.
"ISAMAA Erakond" vs "Erakond Isamaa"), which is why party identity is keyed on the
8-digit registration code.
