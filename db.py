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


def save_capture(type, raw=None, source_url=None, file_path=None):
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute(
            "INSERT INTO captures (type, raw, source_url, file_path) VALUES (?, ?, ?, ?)",
            (type, raw, source_url, file_path),
        )
        return cur.lastrowid


def update_capture(capture_id, summary, tags, intent=None, embedding=None, related_ids=None):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "UPDATE captures SET summary=?, tags=?, intent=?, embedding=?, related_ids=? WHERE id=?",
            (
                summary,
                json.dumps(tags),
                intent,
                json.dumps(embedding) if embedding else None,
                json.dumps(related_ids or []),
                capture_id,
            ),
        )


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
            result.append(d)
        return result


def get_surfaceable():
    """Return all captures eligible for surfacing (non-ephemeral, has summary)."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("""
            SELECT * FROM captures
            WHERE intent != 'ephemeral'
              AND intent IS NOT NULL
              AND summary IS NOT NULL
              AND reviewed = 0
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
