"""Signature words: the most distinctive lemmas per scope (member / party) via TF-IDF.

The corpus is member_speeches. Migration 0014 dropped the raw `lemmas` text column, so lemma
frequencies are read from the `search` tsvector instead (its lexemes are the space-joined
Vabamorf lemmas, lowercased by the 'simple' config, position counts = occurrences). The DB path
feeds per-scope term-count dicts into `compute_from_counts`; a text convenience wrapper tokenises
a string first (used by tests).

A term that appears in every scope (df == N) carries no distinguishing signal and is dropped; the
rest are scored tf * log(N / df) and the top-N per scope are kept. Pure and DB-free.
"""

from __future__ import annotations

import math
from collections import Counter

# Estonian function words + plenary boilerplate that survive lemmatisation and would otherwise
# clutter the tail. df==N dropping handles the truly ubiquitous ones; this trims the near-ubiquitous.
STOPWORDS = frozenset(
    """
    ja ning või aga et kui kas ka ei ole olema see too mis kes kus millal kuidas
    mina sina tema meie teie nemad oma ise seesama
    ta ma me te nad nii ju veel juba ainult
    hea austatud lugupeetud kolleeg härra proua aitäh tänan palun
    riigikogu istung eelnõu küsimus ettepanek
    """.split()
)

MIN_LEMMA_LEN = 3


def _keep(lemma: str) -> bool:
    return len(lemma) >= MIN_LEMMA_LEN and not lemma.isdigit() and lemma not in STOPWORDS


def _tokens(doc: str) -> list[str]:
    return [w for w in doc.split() if _keep(w)]


def compute_from_counts(
    counts: dict[int, dict[str, int]], top_n: int = 25
) -> list[tuple[int, str, float, int]]:
    """Score per-scope term-count dicts. Returns (scope_id, lemma, score, rank), ranked 1..top_n."""
    # Filter each scope's terms, drop scopes left empty.
    filtered = {
        sid: {lemma: n for lemma, n in terms.items() if _keep(lemma)} for sid, terms in counts.items()
    }
    filtered = {sid: terms for sid, terms in filtered.items() if terms}
    n = len(filtered)
    if n == 0:
        return []

    df: Counter[str] = Counter()
    for terms in filtered.values():
        df.update(terms.keys())

    out: list[tuple[int, str, float, int]] = []
    for sid, terms in filtered.items():
        scored = [
            (lemma, count * math.log(n / df[lemma]))
            for lemma, count in terms.items()
            if df[lemma] < n  # drop terms present in every scope (idf == 0)
        ]
        scored.sort(key=lambda t: (-t[1], t[0]))
        for rank, (lemma, score) in enumerate(scored[:top_n], start=1):
            out.append((sid, lemma, round(score, 4), rank))
    return out


def compute_signature_terms(
    docs: dict[int, str], top_n: int = 25
) -> list[tuple[int, str, float, int]]:
    """Text convenience: tokenise each scope's string, then score. Used by tests."""
    counts = {sid: dict(Counter(_tokens(text))) for sid, text in docs.items()}
    return compute_from_counts(counts, top_n)
