import re
import json
import shutil
import asyncio
from pathlib import Path
from typing import Optional, List

import httpx
from bs4 import BeautifulSoup
from fastapi import FastAPI, BackgroundTasks, Form, UploadFile, File, Request, HTTPException
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse

from config import UPLOADS_DIR, DB_PATH
from db import (
    init_db, save_capture, update_capture, get_captures, get_surfaceable,
    mark_surfaced, mark_done, get_all_embeddings, get_captures_by_ids,
    delete_capture, patch_capture, get_review_queue, record_review,
    search_captures, get_brief, get_brief_dates, get_captures_by_intent,
)
from lm import process_text, process_link, process_image, embed, find_related, generate_recall_question, synthesize_answer, generate_extend
from surface import pick

app = FastAPI()
UPLOADS_DIR.mkdir(exist_ok=True)


@app.api_route("/api/watch", methods=["GET", "POST", "OPTIONS"])
async def api_watch():
    return {"status": "ok"}


@app.on_event("startup")
async def startup():
    init_db()


# ── capture endpoints ──────────────────────────────────────────────────────────

@app.post("/capture/text")
async def capture_text(background_tasks: BackgroundTasks, content: str = Form(...)):
    cid = save_capture("text", raw=content)
    background_tasks.add_task(_process, cid, "text", content=content)
    return {"id": cid, "status": "captured"}


@app.post("/capture/link")
async def capture_link(background_tasks: BackgroundTasks, url: str = Form(...)):
    cid = save_capture("link", raw=url, source_url=url)
    background_tasks.add_task(_process, cid, "link", url=url)
    return {"id": cid, "status": "captured"}


@app.post("/capture/image")
async def capture_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    description: str = Form(""),
):
    dest = UPLOADS_DIR / file.filename
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    cid = save_capture("image", raw=description or None, file_path=str(dest))
    background_tasks.add_task(_process, cid, "image", file_path=str(dest), description=description)
    return {"id": cid, "status": "captured"}


# ── uploads ───────────────────────────────────────────────────────────────────

@app.get("/uploads/{filename:path}")
async def serve_upload(filename: str):
    path = UPLOADS_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404)
    return FileResponse(path)


# ── read endpoints ─────────────────────────────────────────────────────────────

@app.get("/captures")
async def list_captures(limit: int = 50, intent: Optional[str] = None):
    if intent:
        return get_captures_by_intent(intent, limit)
    return get_captures(limit)


@app.get("/captures/{capture_id}/related")
async def related_captures(capture_id: int):
    from db import get_all_embeddings
    import json, sqlite3
    from config import DB_PATH
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT related_ids FROM captures WHERE id=?", (capture_id,)).fetchone()
        if not row:
            return []
        ids = json.loads(row["related_ids"] or "[]")
        if not ids:
            return []
        placeholders = ",".join("?" * len(ids))
        rows = conn.execute(f"SELECT * FROM captures WHERE id IN ({placeholders})", ids).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["tags"] = json.loads(d["tags"] or "[]")
            d.pop("embedding", None)
            result.append(d)
        return result


@app.delete("/captures/{capture_id}")
async def delete_capture_endpoint(capture_id: int):
    delete_capture(capture_id)
    return {"status": "deleted"}


# ── surface endpoints ──────────────────────────────────────────────────────────

VALID_MOODS = {"focused", "curious", "restless", "tired", "inspired"}

@app.get("/surface")
async def surface(mode: str = None, n: int = 3, mood: str = None):
    mood = mood if mood in VALID_MOODS else None
    include_ephemeral = mood == "bored"
    candidates = get_surfaceable(include_ephemeral=include_ephemeral)
    items = pick(candidates, n=n, mode=mode, mood=mood)
    for item in items:
        related_ids = json.loads(item.get("related_ids") or "[]")
        item["related"] = get_captures_by_ids(related_ids)
        item.pop("embedding", None)
    return items


@app.post("/events")
async def log_event(request: Request):
    data = await request.json()
    with __import__('sqlite3').connect(DB_PATH) as conn:
        conn.execute(
            "INSERT INTO events (capture_id, event, value, created_at) VALUES (?, ?, ?, datetime('now','localtime'))",
            (data.get("capture_id"), data.get("event"), str(data.get("value", "")))
        )
    return {"status": "ok"}


@app.post("/surface/{capture_id}/done")
async def surface_done(capture_id: int):
    mark_done(capture_id)
    return {"status": "done"}


@app.post("/surface/{capture_id}/skip")
async def surface_skip(capture_id: int):
    mark_surfaced(capture_id)
    return {"status": "skipped"}


# ── patch ──────────────────────────────────────────────────────────────────────

class PatchBody(BaseModel):
    intent: Optional[str] = None
    tags: Optional[List[str]] = None

@app.patch("/captures/{capture_id}")
async def patch_capture_endpoint(capture_id: int, body: PatchBody):
    patch_capture(capture_id, intent=body.intent, tags=body.tags)
    return {"status": "updated"}


# ── review (spaced repetition) ─────────────────────────────────────────────────

@app.get("/review")
async def review_queue(limit: int = 10):
    return get_review_queue(limit)


class ReviewBody(BaseModel):
    rating: str  # "got_it" | "again"

@app.post("/captures/{capture_id}/review")
async def post_review(capture_id: int, body: ReviewBody):
    if body.rating not in ("got_it", "again"):
        raise HTTPException(status_code=400, detail="rating must be 'got_it' or 'again'")
    record_review(capture_id, body.rating)
    return {"status": "recorded"}


# ── search ─────────────────────────────────────────────────────────────────────

@app.get("/search")
async def search(q: str, limit: int = 20):
    if not q.strip():
        return []
    loop = asyncio.get_event_loop()
    query_emb = await loop.run_in_executor(None, embed, q.strip())
    if query_emb:
        all_embs = get_all_embeddings()
        from lm import _cosine
        scored = sorted(
            [(cid, _cosine(query_emb, emb)) for cid, emb in all_embs],
            key=lambda x: x[1], reverse=True
        )
        top = [(cid, score) for cid, score in scored[:limit] if score > 0.3]
        if top:
            score_map = {cid: score for cid, score in top}
            captures = get_captures_by_ids([cid for cid, _ in top])
            for c in captures:
                c["score"] = round(score_map.get(c["id"], 0), 3)
            captures.sort(key=lambda c: c["score"], reverse=True)
            return captures
    # fallback: keyword search (no scores)
    return search_captures(q.strip(), limit)


# ── ask: synthesize + extend ───────────────────────────────────────────────────

class AskBody(BaseModel):
    query: str
    capture_ids: List[int]

class ExtendBody(BaseModel):
    query: str
    synthesis: str

@app.post("/ask/synthesize")
async def ask_synthesize(body: AskBody):
    if not body.query.strip() or not body.capture_ids:
        return {"synthesis": "", "tension": None}
    captures = get_captures_by_ids(body.capture_ids[:8])
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, synthesize_answer, body.query.strip(), captures)
    # split off [TENSION: ...] if present
    tension = None
    text = result
    tension_match = re.search(r'\[TENSION:\s*(.*?)\]', result, re.IGNORECASE | re.DOTALL)
    if tension_match:
        tension = tension_match.group(1).strip()
        text = result[:tension_match.start()].strip()
    return {"synthesis": text, "tension": tension}

@app.post("/ask/extend")
async def ask_extend(body: ExtendBody):
    if not body.query.strip() or not body.synthesis.strip():
        return {"gap": "", "questions": []}
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, generate_extend, body.query.strip(), body.synthesis.strip())
    return result


# ── brief ──────────────────────────────────────────────────────────────────────

@app.get("/brief/dates")
async def brief_dates():
    return get_brief_dates()

@app.get("/brief")
async def brief(limit: int = 50, date: Optional[str] = None):
    items = get_brief(limit, date=date)
    grouped: dict[str, list] = {}
    for item in items:
        key = item.get("intent") or "other"
        grouped.setdefault(key, []).append(item)
    return grouped


# ── background processing ──────────────────────────────────────────────────────

async def _process(cid: int, type: str, **kwargs):
    loop = asyncio.get_event_loop()
    try:
        if type == "text":
            result = await loop.run_in_executor(None, process_text, kwargs["content"])

        elif type == "link":
            page_text = await _fetch_text(kwargs["url"])
            result = await loop.run_in_executor(None, process_link, kwargs["url"], page_text)

        elif type == "image":
            result = await loop.run_in_executor(None, process_image, kwargs["file_path"], kwargs.get("description", ""))

        else:
            return

        summary = result.get("summary") or ""
        intent = result.get("intent")
        emb = await loop.run_in_executor(None, embed, summary)
        all_embs = get_all_embeddings()
        related = find_related(emb, all_embs, exclude_id=cid)
        recall_q = await loop.run_in_executor(None, generate_recall_question, summary, intent or "")
        update_capture(cid, summary, result.get("tags", []), intent, emb, related, recall_q)

    except Exception as e:
        print(f"[process error] {e}")


async def _fetch_text(url: str) -> str:
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer"]):
                tag.decompose()
            return soup.get_text(separator=" ", strip=True)[:4000]
    except Exception:
        return ""


app.mount("/", StaticFiles(directory="static", html=True), name="static")
