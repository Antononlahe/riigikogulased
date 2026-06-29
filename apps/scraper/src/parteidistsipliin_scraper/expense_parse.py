"""Parse Riigikogu kuluhüvitised (MP expense-compensation) summaries into per-member rows.

Two CSVs per year, both keyed by member name (huvitisesaaja); the CSV carries no DOB, so the
caller matches to members by normalized name only.

  - koond_YYYY.csv    -> erakond, huvitisesaaja, limiit, kulud, kasutamata, kasutatud_pct[, ...]
                         The spine: annual limit + total spent per member.
  - liikide_YYYY.csv   -> huvitisesaaja, kokku, <10 category columns>
                         The category split; its `kokku` equals koond's `kulud`.

Both files carry a `KOKKU` grand-total row, which is skipped. The category split is attached to
the koond spine by normalized name and returned as a plain dict (stored as JSONB downstream).
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from decimal import Decimal

from parteidistsipliin_scraper.election_parse import normalize_name

# liikide category columns, in display order. Everything in the liikide header except the name
# and the `kokku` total. Kept as the JSONB breakdown keys (the UI maps them to labels).
CATEGORY_COLUMNS = (
    "sõidukulud",
    "side_ja_postikulud",
    "lähetuskulud",
    "majutuskulud",
    "bürookulud",
    "koolituskulud",
    "tõlketeenuse_kulud",
    "uuringud_ja_ekspertiisid",
    "esindus_ja_vastuvõtukulud",
    "tervishoiuteenused",
)


@dataclass(frozen=True)
class ExpenseRow:
    norm_name: str
    raw_name: str
    year: int
    limit_eur: Decimal
    spent_eur: Decimal
    breakdown: dict[str, float] = field(default_factory=dict)


def _amount(s: str | None) -> Decimal | None:
    """Euro amount with a '.' decimal; blank cells are missing, not zero."""
    s = (s or "").strip()
    if not s:
        return None
    try:
        return Decimal(s)
    except (ValueError, ArithmeticError):
        return None


def _is_total_row(name: str) -> bool:
    return normalize_name(name) == "kokku"


def parse_koond(text: str) -> dict[str, tuple[str, Decimal, Decimal]]:
    """Normalized name -> (raw name, limit, spent). Skips the KOKKU total and limit-less rows."""
    out: dict[str, tuple[str, Decimal, Decimal]] = {}
    for row in csv.DictReader(io.StringIO(text)):
        name = (row.get("huvitisesaaja") or "").strip()
        if not name or _is_total_row(name):
            continue
        limit = _amount(row.get("limiit"))
        spent = _amount(row.get("kulud"))
        if limit is None or spent is None:
            continue
        out[normalize_name(name)] = (name, limit, spent)
    return out


def parse_liikide(text: str) -> dict[str, dict[str, float]]:
    """Normalized name -> {category_key: amount}. Skips the KOKKU total; omits blank categories."""
    out: dict[str, dict[str, float]] = {}
    for row in csv.DictReader(io.StringIO(text)):
        name = (row.get("huvitisesaaja") or "").strip()
        if not name or _is_total_row(name):
            continue
        breakdown: dict[str, float] = {}
        for col in CATEGORY_COLUMNS:
            amt = _amount(row.get(col))
            if amt is not None:
                breakdown[col] = float(amt)
        out[normalize_name(name)] = breakdown
    return out


def parse_year(koond_text: str, liikide_text: str, year: int) -> list[ExpenseRow]:
    """Join koond (limit + spent) with liikide (category split) by normalized name for one year.

    koond is the spine: a member needs a limit to appear. The liikide breakdown is attached when
    a name matches; names present only in liikide are dropped (no limit to score against).
    """
    liikide = parse_liikide(liikide_text)
    rows: list[ExpenseRow] = []
    for norm, (raw, limit, spent) in parse_koond(koond_text).items():
        rows.append(
            ExpenseRow(
                norm_name=norm,
                raw_name=raw,
                year=year,
                limit_eur=limit,
                spent_eur=spent,
                breakdown=liikide.get(norm, {}),
            )
        )
    return rows
