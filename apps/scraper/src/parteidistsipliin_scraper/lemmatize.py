"""Estonian lemmatisation via Vabamorf/EstNLTK, used at ingest to build a lemma index.

EstNLTK is a heavy, optional dependency (``pip install '.[nlp]'``) -- the daily vote cron
never needs it, so it is imported lazily here. Lemmatising at ingest (not query time) is what
lets the search collapse Estonian inflections without any server-side dictionary, which Neon
(managed Postgres) would not allow anyway.
"""

from __future__ import annotations

import re

_WORD = re.compile(r"\w", re.UNICODE)
_tagger = None


def _get_tagger():
    global _tagger
    if _tagger is None:
        from estnltk import Text  # lazy: only when actually lemmatising

        _tagger = Text
    return _tagger


def lemmatize(text: str) -> str:
    """Space-joined, lowercased base-form lemmas of `text` (punctuation dropped).

    Returns "" for empty/whitespace input. Raises ImportError if EstNLTK is not installed.
    """
    text = (text or "").strip()
    if not text:
        return ""
    Text = _get_tagger()
    doc = Text(text)
    doc.tag_layer(["morph_analysis"])
    lemmas: list[str] = []
    for word in doc.morph_analysis:
        forms = word.lemma  # list (one per analysis); first is the usual best guess
        lemma = forms[0] if forms else None
        if not lemma or not _WORD.search(lemma):
            continue
        lemmas.append(lemma.lower())
    return " ".join(lemmas)
