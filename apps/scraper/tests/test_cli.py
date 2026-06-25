from datetime import date, timedelta

from parteidistsipliin_scraper.cli import _year_windows


def test_year_windows_cover_range_without_gaps_or_overlap():
    start, end = date(2023, 4, 10), date(2026, 6, 25)
    wins = list(_year_windows(start, end))
    assert wins[0][0] == start
    assert wins[-1][1] == end
    # contiguous: each window starts the day after the previous one ends, no gaps/overlap.
    for (_, prev_hi), (next_lo, _) in zip(wins, wins[1:], strict=False):
        assert next_lo == prev_hi + timedelta(days=1)
    # every window stays under the ~2-year endpoint cap that returns 418.
    for lo, hi in wins:
        assert (hi - lo).days <= 364
