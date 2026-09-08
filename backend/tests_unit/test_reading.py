"""Règles de lecture partagées (progression, série, visibilité) : tests purs."""
import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import reading as r  # noqa: E402


def test_progress_never_goes_back_and_clamps():
    book = {"type": "papier", "pages": 300, "progress_page": 120, "status": "en_cours"}
    assert "progress_page" not in r.progress_update(book, page=100)          # recul ignoré
    u = r.progress_update(book, page=150)
    assert u["progress_page"] == 150 and u["delta"] == 30 and "status" not in u
    u = r.progress_update(book, page=999)
    assert u["progress_page"] == 300 and u["status"] == "termine" and u["read_count"] == 1


def test_progress_starts_book_and_wattpad_chapters():
    book = {"type": "papier", "pages": None, "progress_page": 0, "status": "a_lire"}
    u = r.progress_update(book, page=12)
    assert u["progress_page"] == 12 and u["status"] == "en_cours" and u["delta"] == 12
    wp = {"type": "wattpad", "chapters": 40, "progress_chapter": 3, "status": "en_cours"}
    u = r.progress_update(wp, chapter=7)
    assert u["progress_chapter"] == 7 and u["delta"] == 0


def test_streak():
    days = {"2026-09-05", "2026-09-04"}
    assert r.compute_streak(days, date(2026, 9, 6)) == 2
    assert r.compute_streak(days | {"2026-09-06"}, date(2026, 9, 6)) == 3
    assert r.compute_streak(set(), date(2026, 9, 6)) == 0


def test_quote_visibility_rules():
    adult = {"user_id": "u2", "birthdate": "1990-01-01"}
    minor = {"user_id": "u3", "birthdate": "2015-01-01"}
    owner = {"user_id": "u1"}
    q = {"user_id": "u1", "is_public": False, "visibility": "private"}
    assert r.quote_visible(q, owner)
    assert not r.quote_visible(q, adult)
    q["is_public"] = True
    assert r.quote_visible(q, adult)
    assert not r.quote_visible({**q, "is_hidden": True}, adult)
    assert not r.quote_visible({**q, "is_sensitive": True}, minor)
    assert r.quote_visible({**q, "is_sensitive": True}, adult)
    foll = {"user_id": "u1", "is_public": False, "visibility": "followers"}
    assert r.quote_visible(foll, adult, follows_author=True)
    assert not r.quote_visible(foll, adult, follows_author=False)
    assert not r.is_adult({"user_id": "x"})
