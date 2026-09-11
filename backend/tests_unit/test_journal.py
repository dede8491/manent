"""Tests unitaires du journal de lecture (helpers purs, sans base).

Lancer depuis backend/ :  python3 -m pytest tests_unit -q
"""
import os
import sys
from datetime import datetime, timezone, date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routes import journal as j  # noqa: E402


def test_week_start_is_monday_utc():
    ws = j.week_start(datetime(2026, 9, 6, 23, 30, tzinfo=timezone.utc))  # dimanche
    assert ws == datetime(2026, 8, 31, tzinfo=timezone.utc)
    assert ws.weekday() == 0
    assert j.week_start(datetime(2026, 8, 31, 0, 0, tzinfo=timezone.utc)) == ws


def test_quota_free_and_premium():
    assert j.quota_for(0, False) == {"used": 0, "limit": 3, "remaining": 3, "blocked": False}
    assert j.quota_for(3, False)["blocked"] is True
    assert j.quota_for(2, False)["remaining"] == 1
    q = j.quota_for(40, True)
    assert q["limit"] is None and q["blocked"] is False and q["remaining"] is None


def test_pick_prompt_rotates_and_skips_last():
    prompts = [{"prompt_id": f"p{i}", "active": True} for i in range(3)]
    assert j.pick_prompt(prompts, 0, None)["prompt_id"] == "p0"
    assert j.pick_prompt(prompts, 1, "p0")["prompt_id"] == "p1"
    # même index que le dernier utilisé → on saute au suivant
    assert j.pick_prompt(prompts, 3, "p0")["prompt_id"] == "p1"
    prompts[1]["active"] = False
    assert j.pick_prompt(prompts, 1, None)["prompt_id"] == "p2"
    assert j.pick_prompt([], 5, None) is None
    assert j.pick_prompt([{"prompt_id": "solo"}], 9, "solo")["prompt_id"] == "solo"


def test_streak_tolerates_yesterday():
    today = date(2026, 9, 6)
    days = {"2026-09-05", "2026-09-04", "2026-09-03"}
    assert j.compute_streak(days, today) == 3
    assert j.compute_streak(days | {"2026-09-06"}, today) == 4
    assert j.compute_streak({"2026-09-01"}, today) == 0


def test_mood_series_sorted_and_filtered():
    entries = [
        {"entry_id": "b", "date": "2026-09-02", "mood": 4, "page": 80},
        {"entry_id": "a", "date": "2026-09-01", "mood": 2, "page": 20},
        {"entry_id": "c", "date": "2026-09-02", "mood": None, "page": 90},
        {"entry_id": "d", "date": "2026-09-02", "mood": 5, "page": 40},
    ]
    s = j.mood_series(entries)
    assert [p["entry_id"] for p in s] == ["a", "d", "b"]


def test_wrapup_summary():
    book = {"finished_at": datetime(2026, 9, 6, tzinfo=timezone.utc), "rating": 4, "lessons": ["x"], "pages": 300, "read_count": 1}
    entries = [
        {"entry_id": "e1", "date": "2026-09-01", "mood": 2, "page": 30, "content": "Début lourd, " * 10, "quote_ids": ["q2"]},
        {"entry_id": "e2", "date": "2026-09-03", "mood": 4, "page": 150, "content": "Ça s'ouvre.", "quote_ids": []},
        {"entry_id": "e3", "date": "2026-09-05", "mood": 5, "page": 290, "content": "Éblouie par la fin.", "quote_ids": []},
        {"entry_id": "e4", "date": "2026-09-05", "mood": None, "page": 295, "content": "", "quote_ids": []},
    ]
    quotes = [{"quote_id": "q1", "text": "A", "page": 10, "likes_count": 5}, {"quote_id": "q2", "text": "B", "page": 25, "likes_count": 0}]
    w = j.wrapup_summary(book, entries, quotes)
    assert w["entries_count"] == 4
    assert w["days"] == 6 and w["started"] == "2026-09-01" and w["finished"] == "2026-09-06"
    assert w["mood_avg"] == round((2 + 4 + 5) / 3, 2)
    assert w["mood_dominant"]["value"] in (2, 4, 5)
    assert w["highlights"][0]["entry_id"] == "e3"          # humeur la plus extrême d'abord
    assert w["favorite_quotes"][0]["quote_id"] == "q2"      # citation rattachée à une entrée avant les autres
    assert len(w["highlights"]) == 3 and w["rating"] == 4
    assert j.wrapup_summary({}, [], [])["mood_avg"] is None


def test_moods_scale_is_five_levels_with_palette_colors():
    assert [m["value"] for m in j.MOODS] == [1, 2, 3, 4, 5]
    assert all(m["color"].startswith("#") and m["label"] for m in j.MOODS)
