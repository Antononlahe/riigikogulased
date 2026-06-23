# POC: economic-interest declarations (HDR) — NOT FEASIBLE for current data

Probed 2026-06-23. Verdict: **drop this source.**

## Access model
- **Current register (HDR, 2014+):** published only via Tax Board e-service **e-MTA**
  (`maasikas.emta.ee` → Avalikud päringud → Huvide deklaratsioon). Gated behind **mandatory
  Estonian eID auth** (ID-card / Mobiil-ID / Smart-ID via OAuth/TARA). `GET /login/?lang=et`
  → 303 → `/v1/authorize`. **No public API, no bulk export, no open-data dataset.** A scraper
  has no eID and can't reach the search form. The äriregister precedent does NOT carry over.
- **National open data** (`andmed.eesti.ee` API): no HDR/declaration dataset (`total:0` for
  deklaratsioon / korruptsioon / huvide deklaratsioon / HDR).
- **Riigi Teataja (pre-2014 archive):** auth-free JSON API (`/api/v1/akt/<id>` +
  `/blob-html`), but data is frozen ~2010–2013, many MPs bundled per act, and isikukood /
  address / taxable income / family are legally redacted. Historical backfill only.

## Joinability
Public declarant identity = name + position + employer. **isikukood and DOB redacted**, so the
project's name+DOB join degrades to name+role — weaker than äriregister, and moot since current
data is unreachable and RT predates most current MPs.

## Blocking factor
Mandatory Estonian eID authentication on e-MTA, no API / export / open data. Only realistic
path if ever wanted: a formal data request to the Ministry of Justice (register owner) — not
scraping.

## Samples
- `sample_riigiteataja_322122010005.json` — RT act metadata.
- `sample_declaration_body.html` — a real pre-2014 declaration body (Ester Tuiksoo, RK liige):
  fields = real estate / vehicles / securities / bank accounts / debts / board memberships,
  amounts in kroonid, several fields redacted. Shows the content shape; source is unreachable
  for current MPs.
