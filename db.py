import sqlite3
import json
from config import DB_PATH


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS captures (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                raw TEXT,
                source_url TEXT,
                file_path TEXT,
                summary TEXT,
                tags TEXT DEFAULT '[]',
                intent TEXT,
                created_at TEXT DEFAULT (datetime('now', 'localtime')),
                last_surfaced_at TEXT,
                reviewed INTEGER DEFAULT 0
            )
        """)
        # migrate existing DB if intent column is missing
        cols = [r[1] for r in conn.execute("PRAGMA table_info(captures)").fetchall()]
        conn.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                capture_id INTEGER,
                event TEXT,
                value TEXT,
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        """)
        if "intent" not in cols:
            conn.execute("ALTER TABLE captures ADD COLUMN intent TEXT")
        if "last_surfaced_at" not in cols:
            conn.execute("ALTER TABLE captures ADD COLUMN last_surfaced_at TEXT")
        if "embedding" not in cols:
            conn.execute("ALTER TABLE captures ADD COLUMN embedding TEXT")
        if "related_ids" not in cols:
            conn.execute("ALTER TABLE captures ADD COLUMN related_ids TEXT DEFAULT '[]'")
        if "review_due_at" not in cols:
            conn.execute("ALTER TABLE captures ADD COLUMN review_due_at TEXT")
        if "review_interval" not in cols:
            conn.execute("ALTER TABLE captures ADD COLUMN review_interval INTEGER DEFAULT 1")
        if "review_count" not in cols:
            conn.execute("ALTER TABLE captures ADD COLUMN review_count INTEGER DEFAULT 0")
        if "recall_question" not in cols:
            conn.execute("ALTER TABLE captures ADD COLUMN recall_question TEXT")


def save_capture(type, raw=None, source_url=None, file_path=None):
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute(
            "INSERT INTO captures (type, raw, source_url, file_path) VALUES (?, ?, ?, ?)",
            (type, raw, source_url, file_path),
        )
        return cur.lastrowid


def update_capture(capture_id, summary, tags, intent=None, embedding=None, related_ids=None, recall_question=None):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "UPDATE captures SET summary=?, tags=?, intent=?, embedding=?, related_ids=?, recall_question=? WHERE id=?",
            (
                summary,
                json.dumps(tags),
                intent,
                json.dumps(embedding) if embedding else None,
                json.dumps(related_ids or []),
                recall_question,
                capture_id,
            ),
        )


def delete_capture(capture_id: int):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("DELETE FROM captures WHERE id=?", (capture_id,))


def get_captures_by_ids(ids: list) -> list:
    if not ids:
        return []
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        placeholders = ",".join("?" * len(ids))
        rows = conn.execute(
            f"SELECT * FROM captures WHERE id IN ({placeholders})", ids
        ).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["tags"] = json.loads(d["tags"] or "[]")
            d.pop("embedding", None)
            d.pop("related_ids", None)
            result.append(d)
        return result


def get_all_embeddings():
    """Return [(id, embedding)] for all captures that have embeddings."""
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute(
            "SELECT id, embedding FROM captures WHERE embedding IS NOT NULL"
        ).fetchall()
        return [(r[0], json.loads(r[1])) for r in rows]


def get_captures_by_intent(intent: str, limit=50):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM captures WHERE intent=? ORDER BY created_at DESC LIMIT ?", (intent, limit)
        ).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["tags"] = json.loads(d["tags"] or "[]")
            d.pop("embedding", None)
            result.append(d)
        return result


def get_captures(limit=50):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM captures ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["tags"] = json.loads(d["tags"] or "[]")
            d["related_ids"] = json.loads(d.get("related_ids") or "[]")
            result.append(d)
        return result


def get_surfaceable(include_ephemeral=False):
    """Return all captures eligible for surfacing."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        where = "intent IS NOT NULL AND summary IS NOT NULL AND reviewed = 0"
        if not include_ephemeral:
            where += " AND intent != 'ephemeral'"
        rows = conn.execute(f"""
            SELECT * FROM captures
            WHERE {where}
            ORDER BY created_at DESC
        """).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["tags"] = json.loads(d["tags"] or "[]")
            result.append(d)
        return result


def mark_surfaced(capture_id):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "UPDATE captures SET last_surfaced_at = datetime('now', 'localtime') WHERE id = ?",
            (capture_id,),
        )


def mark_done(capture_id):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "UPDATE captures SET reviewed = 1 WHERE id = ?",
            (capture_id,),
        )


def patch_capture(capture_id: int, intent: str = None, tags: list = None):
    with sqlite3.connect(DB_PATH) as conn:
        if intent is not None:
            conn.execute("UPDATE captures SET intent=? WHERE id=?", (intent, capture_id))
        if tags is not None:
            conn.execute("UPDATE captures SET tags=? WHERE id=?", (json.dumps(tags), capture_id))


def get_review_queue(limit=10) -> list:
    """Return learn captures with review_due_at <= now, ordered by due date."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("""
            SELECT * FROM captures
            WHERE intent = 'learn'
              AND summary IS NOT NULL
              AND (
                review_due_at IS NULL
                OR review_due_at <= datetime('now', 'localtime')
              )
            ORDER BY COALESCE(review_due_at, created_at) ASC
            LIMIT ?
        """, (limit,)).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["tags"] = json.loads(d["tags"] or "[]")
            d["related_ids"] = json.loads(d.get("related_ids") or "[]")
            d.pop("embedding", None)
            result.append(d)
        return result


def record_review(capture_id: int, rating: str):
    """SM-2 simplified: rating is 'got_it' or 'again'."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT review_interval, review_count FROM captures WHERE id=?", (capture_id,)
        ).fetchone()
        if not row:
            return
        interval = row["review_interval"] or 1
        count = row["review_count"] or 0
        if rating == "got_it":
            new_interval = max(1, round(interval * 2.5))
            new_count = count + 1
        else:
            new_interval = 1
            new_count = count
        conn.execute("""
            UPDATE captures
            SET review_interval = ?,
                review_count = ?,
                review_due_at = datetime('now', 'localtime', ? || ' days'),
                last_surfaced_at = datetime('now', 'localtime')
            WHERE id = ?
        """, (new_interval, new_count, str(new_interval), capture_id))


def search_captures(q: str, limit=20) -> list:
    pattern = f"%{q}%"
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("""
            SELECT * FROM captures
            WHERE summary IS NOT NULL AND (
                summary LIKE ? OR tags LIKE ? OR raw LIKE ?
            )
            ORDER BY created_at DESC
            LIMIT ?
        """, (pattern, pattern, pattern, limit)).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["tags"] = json.loads(d["tags"] or "[]")
            d["related_ids"] = json.loads(d.get("related_ids") or "[]")
            d.pop("embedding", None)
            result.append(d)
        return result


def get_brief(limit=50, date: str = None) -> list:
    """Captures for digest view. date='YYYY-MM-DD' fetches ALL captures for that day, else recent unreviewed."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        if date:
            rows = conn.execute("""
                SELECT * FROM captures
                WHERE summary IS NOT NULL
                  AND date(created_at) = ?
                ORDER BY created_at DESC
            """, (date,)).fetchall()
        else:
            rows = conn.execute("""
                SELECT * FROM captures
                WHERE summary IS NOT NULL AND reviewed = 0
                ORDER BY created_at DESC
                LIMIT ?
            """, (limit,)).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["tags"] = json.loads(d["tags"] or "[]")
            d["related_ids"] = json.loads(d.get("related_ids") or "[]")
            d.pop("embedding", None)
            result.append(d)
        return result


def get_brief_dates(limit=30) -> list:
    """Return distinct dates that have captures, newest first."""
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute("""
            SELECT date(created_at) as day, COUNT(*) as count
            FROM captures
            WHERE summary IS NOT NULL
            GROUP BY day
            ORDER BY day DESC
            LIMIT ?
        """, (limit,)).fetchall()
        return [{"date": r[0], "count": r[1]} for r in rows]
