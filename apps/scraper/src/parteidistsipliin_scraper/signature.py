"""Signature words: the most distinctive lemmas per scope (member / party) via TF-IDF.

Input is already-lemmatised, space-joined text (member_speeches.lemmas). A term that appears in
every document (df == N) carries no distinguishing signal and is dropped; the rest are scored
tf * log(N / df) and the top-N per document are kept.

Pure and DB-free so it unit-tests without a database; the CLI feeds it the per-scope documents.
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


def _tokens(doc: str) -> list[str]:
    return [
        w
        for w in doc.split()
        if len(w) >= MIN_LEMMA_LEN and not w.isdigit() and w not in STOPWORDS
    ]


def compute_signature_terms(
    docs: dict[int, str], top_n: int = 25
) -> list[tuple[int, str, float, int]]:
    """Return (scope_id, lemma, score, rank) rows, ranked 1..top_n within each scope by score."""
    tokenised = {sid: _tokens(text) for sid, text in docs.items()}
    tokenised = {sid: toks for sid, toks in tokenised.items() if toks}
    n = len(tokenised)
    if n == 0:
        return []

    df: Counter[str] = Counter()
    for toks in tokenised.values():
        df.update(set(toks))

    out: list[tuple[int, str, float, int]] = []
    for sid, toks in tokenised.items():
        tf = Counter(toks)
        scored = [
            (lemma, count * math.log(n / df[lemma]))
            for lemma, count in tf.items()
            if df[lemma] < n  # drop terms present in every scope (idf == 0)
        ]
        # Highest score first; lemma as a stable tiebreak so ranks are deterministic.
        scored.sort(key=lambda t: (-t[1], t[0]))
        for rank, (lemma, score) in enumerate(scored[:top_n], start=1):
            out.append((sid, lemma, round(score, 4), rank))
    return out
