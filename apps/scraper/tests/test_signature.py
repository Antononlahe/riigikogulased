from parteidistsipliin_scraper.signature import compute_from_counts, compute_signature_terms


def test_distinctive_lemma_ranks_first():
    # 'kala' appears only in doc 1 -> distinctive there; 'ja' is everywhere -> not distinctive.
    docs = {
        1: "kala kala ja ja vesi",
        2: "auto auto ja ja tee",
        3: "maja maja ja ja aed",
    }
    rows = compute_signature_terms(docs, top_n=3)
    top1 = [(lemma, rank) for sid, lemma, score, rank in rows if sid == 1 and rank == 1]
    assert top1 == [("kala", 1)]
    # a term present in every document (df == N) carries no distinctiveness and is dropped.
    assert all(lemma != "ja" for sid, lemma, score, rank in rows)


def test_ranks_are_contiguous_per_scope_and_capped():
    docs = {
        1: "alpha beeta gamma delta alpha beeta gamma alpha beeta alpha",
        2: "yksi kaksi kolme",
    }
    rows = compute_signature_terms(docs, top_n=2)
    ranks_1 = sorted(rank for sid, lemma, score, rank in rows if sid == 1)
    assert ranks_1 == [1, 2]  # capped at top_n, ranks 1..2 contiguous


def test_empty_and_blank_docs_yield_no_rows():
    assert compute_signature_terms({1: "", 2: "   "}, top_n=5) == []


def test_compute_from_counts_matches_text_path():
    # The DB path feeds term-count dicts (read from the tsvector) straight into compute_from_counts.
    counts = {
        1: {"kala": 2, "ja": 2, "vesi": 1},
        2: {"auto": 2, "ja": 2, "tee": 1},
        3: {"maja": 2, "ja": 2, "aed": 1},
    }
    rows = compute_from_counts(counts, top_n=3)
    top1 = [(lemma, rank) for sid, lemma, score, rank in rows if sid == 1 and rank == 1]
    assert top1 == [("kala", 1)]
    assert all(lemma != "ja" for sid, lemma, score, rank in rows)


def test_exclude_drops_member_names():
    # Member names passed via `exclude` never surface; the next word takes rank 1.
    counts = {1: {"hussar": 5, "kala": 2}, 2: {"auto": 3}}
    rows = compute_from_counts(counts, top_n=3, exclude=frozenset({"hussar"}))
    top1 = [(lemma, rank) for sid, lemma, score, rank in rows if sid == 1 and rank == 1]
    assert top1 == [("kala", 1)]
